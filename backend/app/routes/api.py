from datetime import datetime, timezone
from uuid import uuid4

from flask import Blueprint, jsonify, request

from ..data import (
    ADMIN_EMAIL,
    BUILTIN_ADMIN_PHONES,
    add_location,
    add_menu_item,
    browse_data_dir,
    check_phone_exists,
    clear_user_pin,
    delete_location,
    delete_menu_item,
    get_data_dir,
    get_order,
    is_admin_email,
    is_admin_phone,
    link_email_to_user,
    link_phone_to_user,
    list_data_files,
    list_orders,
    list_users,
    load_admins,
    load_locations,
    load_menu,
    load_settings,
    load_user_by_id,
    read_data_file,
    save_admins,
    save_order,
    save_settings,
    set_user_pin,
    signup_user,
    social_login_or_create,
    suggested_prep_minutes,
    update_location,
    update_menu_item,
    update_order,
    verify_pin,
)

bp = Blueprint('api', __name__)

VALID_STATUSES = {'Pending', 'Accepted', 'Ready', 'Completed'}


@bp.get('/health')
def health():
    import os
    data_dir = os.getenv('DATA_DIR', 'data')
    return jsonify({'status': 'ok', 'dataDir': data_dir})


def _is_admin() -> bool:
    phone = (request.headers.get('X-Admin-Phone') or '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if phone and is_admin_phone(phone):
        return True
    email = (request.headers.get('X-Admin-Email') or '').strip().lower()
    if email and is_admin_email(email):
        return True
    return False


@bp.post('/login')
def login():
    """Legacy endpoint kept for social-login users."""
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    phone = str(payload.get('phone', '')).replace(' ', '').replace('-', '').replace('(', '').replace(')', '').strip()
    email = str(payload.get('email', '')).strip().lower()
    if not name or not phone:
        return jsonify({'error': 'Name and phone are required.'}), 400
    is_admin = is_admin_phone(phone) or (bool(email) and is_admin_email(email))
    resp: dict = {'name': name, 'phone': phone, 'isAdmin': is_admin}
    if email:
        resp['email'] = email
    return jsonify(resp)


# ── Phone + PIN auth ─────────────────────────────────────────────────────────

def _clean_phone(raw: str) -> str:
    digits = ''.join(c for c in raw if c.isdigit())
    return digits[-10:] if len(digits) > 10 else digits


@bp.post('/auth/check-phone')
def auth_check_phone():
    payload = request.get_json(silent=True) or {}
    phone = _clean_phone(str(payload.get('phone', '')))
    if len(phone) < 10:
        return jsonify({'error': 'Valid 10-digit phone required.'}), 400
    result = check_phone_exists(phone)
    return jsonify(result)


@bp.post('/auth/login')
def auth_login():
    payload = request.get_json(silent=True) or {}
    phone = _clean_phone(str(payload.get('phone', '')))
    pin = str(payload.get('pin', '')).strip()
    if not phone or not pin:
        return jsonify({'error': 'Phone and PIN are required.'}), 400
    user = verify_pin(phone, pin)
    if user is None:
        return jsonify({'success': False, 'message': 'Incorrect PIN. Please try again.'}), 401
    public = {k: v for k, v in user.items() if k != 'pinHash'}
    public['isAdmin'] = is_admin_phone(phone)
    public['authMethod'] = 'phone'
    return jsonify({'success': True, 'user': public})


@bp.post('/auth/signup')
def auth_signup():
    payload = request.get_json(silent=True) or {}
    phone = _clean_phone(str(payload.get('phone', '')))
    name = str(payload.get('name', '')).strip()
    pin = str(payload.get('pin', '')).strip()
    if not phone or not name or not pin:
        return jsonify({'error': 'Phone, name and PIN are required.'}), 400
    if len(pin) != 4 or not pin.isdigit():
        return jsonify({'error': 'PIN must be exactly 4 digits.'}), 400
    try:
        user = signup_user(phone, name, pin)
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 409
    public = {k: v for k, v in user.items() if k != 'pinHash'}
    public['isAdmin'] = is_admin_phone(phone)
    public['authMethod'] = 'phone'
    return jsonify({'success': True, 'user': public}), 201


@bp.post('/auth/set-pin')
def auth_set_pin():
    """Set PIN for an existing user who doesn't have one yet (first-time)."""
    payload = request.get_json(silent=True) or {}
    phone = _clean_phone(str(payload.get('phone', '')))
    pin = str(payload.get('pin', '')).strip()
    if not phone or not pin:
        return jsonify({'error': 'Phone and PIN are required.'}), 400
    if len(pin) != 4 or not pin.isdigit():
        return jsonify({'error': 'PIN must be exactly 4 digits.'}), 400
    user = set_user_pin(phone, pin)
    if user is None:
        return jsonify({'success': False, 'message': 'Phone not found.'}), 404
    public = {k: v for k, v in user.items() if k != 'pinHash'}
    public['isAdmin'] = is_admin_phone(phone)
    public['authMethod'] = 'phone'
    return jsonify({'success': True, 'user': public})


@bp.post('/admin/users/reset-pin')
def admin_reset_pin():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    phone = _clean_phone(str(payload.get('phone', '')))
    if not phone:
        return jsonify({'error': 'phone required.'}), 400
    ok = clear_user_pin(phone)
    if not ok:
        return jsonify({'success': False, 'message': 'User not found.'}), 404
    return jsonify({'success': True, 'message': 'PIN cleared. User must set a new PIN on next login.'})


# ── Social auth ───────────────────────────────────────────────────────────────

def _public_user(user: dict) -> dict:
    """Strip sensitive fields before sending to client."""
    return {k: v for k, v in user.items() if k not in ('pinHash',)}


@bp.post('/auth/social')
def auth_social():
    """Social login: find or create a user by email. Called after Auth0 popup."""
    payload = request.get_json(silent=True) or {}
    email = str(payload.get('email', '')).strip().lower()
    name = str(payload.get('name', '')).strip() or email.split('@')[0] or 'User'
    picture = str(payload.get('picture', '')).strip()
    if not email:
        return jsonify({'error': 'email is required.'}), 400
    user = social_login_or_create(email, name, picture)
    pub = _public_user(user)
    pub['isAdmin'] = is_admin_phone(user.get('phone', '')) or is_admin_email(email)
    pub['authMethod'] = 'social'
    return jsonify({'success': True, 'user': pub})


@bp.post('/auth/link-email')
def auth_link_email():
    """Link a social email to a logged-in user (identified by userId in body)."""
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get('userId', '')).strip()
    email = str(payload.get('email', '')).strip().lower()
    if not user_id or not email:
        return jsonify({'error': 'userId and email are required.'}), 400
    user, err = link_email_to_user(user_id, email)
    if err:
        return jsonify({'success': False, 'message': err}), 409
    return jsonify({'success': True, 'user': _public_user(user)})


@bp.post('/auth/link-phone')
def auth_link_phone():
    """Link a phone + PIN to an existing social-only user."""
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get('userId', '')).strip()
    phone = _clean_phone(str(payload.get('phone', '')))
    pin = str(payload.get('pin', '')).strip()
    if not user_id or not phone or not pin:
        return jsonify({'error': 'userId, phone and pin are required.'}), 400
    if len(pin) != 4 or not pin.isdigit():
        return jsonify({'error': 'PIN must be exactly 4 digits.'}), 400
    user, err = link_phone_to_user(user_id, phone, pin)
    if err:
        return jsonify({'success': False, 'message': err}), 409
    pub = _public_user(user)
    pub['isAdmin'] = is_admin_phone(phone)
    pub['authMethod'] = 'phone'
    return jsonify({'success': True, 'user': pub})


@bp.get('/locations')
def get_locations():
    return jsonify(load_locations())


@bp.get('/settings')
def get_public_settings():
    """Public endpoint: returns non-sensitive settings (prep times)."""
    s = load_settings()
    return jsonify({
        'chickenPrepMinutes': s.get('chickenPrepMinutes', 20),
        'goatPrepMinutes': s.get('goatPrepMinutes', 45),
    })


@bp.get('/menu')
def get_menu():
    return jsonify(load_menu())


@bp.get('/orders')
def get_orders():
    phone_filter = request.args.get('phone', '').strip()
    orders = list_orders()
    if phone_filter and not _is_admin():
        orders = [o for o in orders if o.get('phone') == phone_filter]
    return jsonify(orders)


@bp.get('/orders/<order_id>')
def get_single_order(order_id: str):
    order = get_order(order_id)
    if order is None:
        return jsonify({'error': 'Order not found.'}), 404
    return jsonify(order)


@bp.post('/orders')
def create_order():
    payload = request.get_json(silent=True) or {}
    customer_name = str(payload.get('customerName', '')).strip()
    phone = str(payload.get('phone', '')).replace(' ', '').replace('-', '').replace('(', '').replace(')', '').strip()
    pickup_time = str(payload.get('pickupTime', '')).strip()
    items = payload.get('items') or []
    location_id = str(payload.get('locationId', '')).strip()
    location_name = str(payload.get('locationName', '')).strip()
    is_delivery = bool(payload.get('isDelivery', False))

    if not customer_name or not phone or not pickup_time:
        return jsonify({'error': 'Customer name, phone, and pickup time are required.'}), 400
    if not isinstance(items, list) or not items:
        return jsonify({'error': 'At least one cart item is required.'}), 400

    normalized_items = []
    total = 0.0
    for item in items:
        item_id = str(item.get('id', '')).strip()
        name = str(item.get('name', '')).strip()
        try:
            qty = int(item.get('qty', 0))
            price = float(item.get('price', 0))
        except (TypeError, ValueError):
            return jsonify({'error': 'Each item must include a valid quantity and price.'}), 400
        if not item_id or not name or qty <= 0 or price < 0:
            return jsonify({'error': 'Each item must include id, name, positive qty, and price.'}), 400

        line_total = round(qty * price, 2)
        total += line_total
        normalized_items.append(
            {
                'id': item_id,
                'name': name,
                'qty': qty,
                'price': round(price, 2),
                'lineTotal': line_total,
            }
        )

    order = {
        'id': str(uuid4()),
        'customerName': customer_name,
        'phone': phone,
        'pickupTime': pickup_time,
        'locationId': location_id,
        'locationName': location_name,
        'isDelivery': is_delivery,
        'confirmedDeliveryTime': None,
        'items': normalized_items,
        'total': round(total, 2),
        'status': 'Pending',
        'prepMinutes': suggested_prep_minutes(normalized_items),
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'acceptedAt': None,
        'readyAt': None,
    }
    save_order(order)
    return jsonify(order), 201


@bp.patch('/orders/<order_id>')
def patch_order(order_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403

    order = get_order(order_id)
    if order is None:
        return jsonify({'error': 'Order not found.'}), 404

    payload = request.get_json(silent=True) or {}
    updates: dict = {}

    if 'status' in payload:
        new_status = str(payload['status']).strip()
        if new_status not in VALID_STATUSES:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(VALID_STATUSES)}'}), 400
        updates['status'] = new_status
        now = datetime.now(timezone.utc).isoformat()
        if new_status == 'Accepted' and not order.get('acceptedAt'):
            updates['acceptedAt'] = now
        if new_status == 'Ready' and not order.get('readyAt'):
            updates['readyAt'] = now

    if 'prepMinutes' in payload:
        try:
            prep = int(payload['prepMinutes'])
            if prep < 1:
                raise ValueError
            updates['prepMinutes'] = prep
        except (TypeError, ValueError):
            return jsonify({'error': 'prepMinutes must be a positive integer.'}), 400

    if 'confirmedDeliveryTime' in payload:
        cdt = payload['confirmedDeliveryTime']
        updates['confirmedDeliveryTime'] = str(cdt).strip() if cdt else None

    updated = update_order(order_id, updates)
    return jsonify(updated)


# ── Admin management routes ──────────────────────────────────────────────────

@bp.get('/admin/admins')
def get_admins():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    stored = load_admins()
    return jsonify({
        'builtinPhones': sorted(BUILTIN_ADMIN_PHONES),
        'phones': stored.get('phones', []),
        'emails': stored.get('emails', []),
    })


@bp.post('/admin/admins')
def add_admin():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    phone = str(payload.get('phone', '')).replace(' ', '').replace('-', '').replace('(', '').replace(')', '').strip()
    email = str(payload.get('email', '')).strip().lower()
    if not phone and not email:
        return jsonify({'error': 'phone or email is required.'}), 400
    stored = load_admins()
    if phone:
        if phone not in stored['phones'] and phone not in BUILTIN_ADMIN_PHONES:
            stored.setdefault('phones', []).append(phone)
    if email:
        if email not in stored.get('emails', []) and email != ADMIN_EMAIL:
            stored.setdefault('emails', []).append(email)
    save_admins(stored)
    return jsonify({'ok': True, 'phones': stored.get('phones', []), 'emails': stored.get('emails', [])})


@bp.delete('/admin/admins')
def remove_admin():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    phone = str(payload.get('phone', '')).replace(' ', '').replace('-', '').replace('(', '').replace(')', '').strip()
    email = str(payload.get('email', '')).strip().lower()
    if not phone and not email:
        return jsonify({'error': 'phone or email is required.'}), 400
    if phone and phone in BUILTIN_ADMIN_PHONES:
        return jsonify({'error': 'Cannot remove a built-in admin phone.'}), 400
    stored = load_admins()
    if phone and phone in stored.get('phones', []):
        stored['phones'].remove(phone)
    if email and email in stored.get('emails', []):
        stored['emails'].remove(email)
    save_admins(stored)
    return jsonify({'ok': True, 'phones': stored.get('phones', []), 'emails': stored.get('emails', [])})


# ── Data folder browser routes ───────────────────────────────────────────────

@bp.get('/admin/data')
def browse_data():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    rel_path = request.args.get('path', '').strip()
    return jsonify(browse_data_dir(rel_path))


@bp.get('/admin/data/file')
def read_data():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    rel_path = request.args.get('path', '').strip()
    if not rel_path:
        return jsonify({'error': 'path is required.'}), 400
    content = read_data_file(rel_path)
    if content is None:
        return jsonify({'error': 'File not found or not readable.'}), 404
    return jsonify({'path': rel_path, 'content': content})


@bp.get('/admin/data/download')
def download_data():
    import io, zipfile
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    from flask import Response
    data_dir = get_data_dir().resolve()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(data_dir.rglob('*')):
            if p.is_file():
                zf.write(p, p.relative_to(data_dir))
    buf.seek(0)
    return Response(
        buf.read(),
        mimetype='application/zip',
        headers={'Content-Disposition': 'attachment; filename=halalcart-data.zip'},
    )


# ── Users route ──────────────────────────────────────────────────────────────

@bp.get('/admin/users')
def admin_get_users():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    return jsonify(list_users())


# ── Menu management routes ───────────────────────────────────────────────────

@bp.get('/admin/menu')
def admin_get_menu():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    return jsonify(load_menu())


@bp.post('/admin/menu')
def admin_add_menu_item():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    category = str(payload.get('category', '')).strip()
    if not name or not category:
        return jsonify({'error': 'name and category are required.'}), 400
    try:
        price = float(payload.get('price', 0))
        if price < 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'price must be a non-negative number.'}), 400
    item = add_menu_item({
        'name': name,
        'category': category,
        'price': price,
        'unit': str(payload.get('unit', '')).strip(),
        'description': str(payload.get('description', '')).strip(),
    })
    return jsonify(item), 201


@bp.patch('/admin/menu/<item_id>')
def admin_patch_menu_item(item_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    updates: dict = {}
    if 'name' in payload:
        name = str(payload['name']).strip()
        if not name:
            return jsonify({'error': 'name cannot be empty.'}), 400
        updates['name'] = name
    if 'price' in payload:
        try:
            price = float(payload['price'])
            if price < 0:
                raise ValueError
            updates['price'] = round(price, 2)
        except (TypeError, ValueError):
            return jsonify({'error': 'price must be a non-negative number.'}), 400
    if 'unit' in payload:
        updates['unit'] = str(payload['unit']).strip()
    if 'description' in payload:
        updates['description'] = str(payload['description']).strip()
    if 'category' in payload:
        updates['category'] = str(payload['category']).strip()
    if not updates:
        return jsonify({'error': 'No valid fields provided.'}), 400
    item = update_menu_item(item_id, updates)
    if item is None:
        return jsonify({'error': 'Menu item not found.'}), 404
    return jsonify(item)


@bp.delete('/admin/menu/<item_id>')
def admin_delete_menu_item(item_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    deleted = delete_menu_item(item_id)
    if not deleted:
        return jsonify({'error': 'Menu item not found.'}), 404
    return jsonify({'ok': True})


# ── Settings routes ──────────────────────────────────────────────────────────

@bp.get('/admin/settings')
def admin_get_settings():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    return jsonify(load_settings())


@bp.patch('/admin/settings')
def admin_patch_settings():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    settings = load_settings()
    if 'chickenPrepMinutes' in payload:
        try:
            val = int(payload['chickenPrepMinutes'])
            if val < 1:
                raise ValueError
            settings['chickenPrepMinutes'] = val
        except (TypeError, ValueError):
            return jsonify({'error': 'chickenPrepMinutes must be a positive integer.'}), 400
    if 'goatPrepMinutes' in payload:
        try:
            val = int(payload['goatPrepMinutes'])
            if val < 1:
                raise ValueError
            settings['goatPrepMinutes'] = val
        except (TypeError, ValueError):
            return jsonify({'error': 'goatPrepMinutes must be a positive integer.'}), 400
    if 'deletePin' in payload:
        val = str(payload['deletePin']).strip()
        if val:
            settings['deletePin'] = val
    save_settings(settings)
    return jsonify(settings)


# ── Location management routes ────────────────────────────────────────────────

@bp.get('/admin/locations')
def admin_get_locations():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    return jsonify(load_locations())


@bp.post('/admin/locations')
def admin_add_location():
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    if not name:
        return jsonify({'error': 'name is required.'}), 400
    loc = add_location({
        'name': name,
        'address': str(payload.get('address', '')).strip(),
        'phone': str(payload.get('phone', '')).strip(),
        'hours': payload.get('hours'),
    })
    return jsonify(loc), 201


@bp.patch('/admin/locations/<loc_id>')
def admin_patch_location(loc_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    payload = request.get_json(silent=True) or {}
    updates: dict = {}
    for field in ('name', 'address', 'phone', 'hours', 'deliveryMode'):
        if field in payload:
            updates[field] = payload[field]
    if not updates:
        return jsonify({'error': 'No valid fields provided.'}), 400
    loc = update_location(loc_id, updates)
    if loc is None:
        return jsonify({'error': 'Location not found.'}), 404
    return jsonify(loc)


@bp.delete('/admin/locations/<loc_id>')
def admin_delete_location(loc_id: str):
    if not _is_admin():
        return jsonify({'error': 'Admin access required.'}), 403
    deleted = delete_location(loc_id)
    if not deleted:
        return jsonify({'error': 'Location not found.'}), 404
    return jsonify({'ok': True})
