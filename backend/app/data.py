import hashlib
import json
import os
from pathlib import Path
from typing import Any, Optional


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / 'data'

# Built-in admin phones — always valid regardless of admins.json
BUILTIN_ADMIN_PHONES: set[str] = {'7327184414', '9179419406'}
# Legacy alias kept for backward compatibility
ADMIN_PHONE = '7327184414'
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', '').strip().lower()
CHICKEN_PREP_MINUTES = 20
DEFAULT_GOAT_PREP_MINUTES = 45

DEFAULT_MENU: list[dict] = [
    {'id': 'g3', 'category': 'Goat',    'name': 'Goat Leg',            'price': 35.00, 'unit': 'per leg', 'description': 'Bone-in goat leg, great for biryani'},
    {'id': 'g4', 'category': 'Goat',    'name': 'Goat Shoulder',       'price': 28.00, 'unit': 'per lb',  'description': 'Tender goat shoulder, perfect for curry'},
    {'id': 'g5', 'category': 'Goat',    'name': 'Goat Chops',          'price': 22.00, 'unit': 'per lb',  'description': 'Goat rib chops, halal certified'},
    {'id': 'g6', 'category': 'Goat',    'name': 'Goat Keema',          'price': 18.00, 'unit': 'per lb',  'description': 'Fresh ground goat meat'},
    {'id': 'c1', 'category': 'Chicken', 'name': 'Whole Chicken',       'price': 12.00, 'unit': 'per bird','description': 'Fresh whole chicken, halal slaughtered'},
    {'id': 'c2', 'category': 'Chicken', 'name': 'Chicken Leg Quarters','price':  3.50, 'unit': 'per lb',  'description': 'Juicy leg quarters, skin-on'},
    {'id': 'c3', 'category': 'Chicken', 'name': 'Boneless Breast',     'price':  5.99, 'unit': 'per lb',  'description': 'Skinless boneless chicken breast'},
    {'id': 'c4', 'category': 'Chicken', 'name': 'Chicken Wings',       'price':  4.50, 'unit': 'per lb',  'description': 'Fresh chicken wings'},
    {'id': 'c5', 'category': 'Chicken', 'name': 'Chicken Keema',       'price':  4.99, 'unit': 'per lb',  'description': 'Ground chicken, great for kebabs'},
    {'id': 'f1', 'category': 'Fish',    'name': 'Whole Fish',          'price': 14.00, 'unit': 'per fish','description': 'Fresh whole fish, cleaned'},
    {'id': 'f2', 'category': 'Fish',    'name': 'Fish Fillet',         'price':  8.99, 'unit': 'per lb',  'description': 'Fresh boneless fish fillet'},
    {'id': 'f3', 'category': 'Fish',    'name': 'Shrimp',              'price': 12.99, 'unit': 'per lb',  'description': 'Fresh shrimp, peeled and deveined'},
]


def get_data_dir() -> Path:
    configured = os.getenv('DATA_DIR')
    return Path(configured).resolve() if configured else DEFAULT_DATA_DIR


def get_orders_dir() -> Path:
    orders_dir = get_data_dir() / 'orders'
    orders_dir.mkdir(parents=True, exist_ok=True)
    return orders_dir


def _order_day_dir(created_at_iso: str) -> Path:
    """Return data/orders/YYYY/MM/DD/ for a given ISO timestamp, creating it if needed."""
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(created_at_iso.replace('Z', '+00:00'))
        day_dir = get_orders_dir() / dt.strftime('%Y') / dt.strftime('%m') / dt.strftime('%d')
    except (ValueError, AttributeError):
        from datetime import date as _date
        d = _date.today()
        day_dir = get_orders_dir() / d.strftime('%Y') / d.strftime('%m') / d.strftime('%d')
    day_dir.mkdir(parents=True, exist_ok=True)
    return day_dir


def _find_order_file(order_id: str) -> Optional[Path]:
    """Find an order JSON file anywhere under data/orders/."""
    for p in get_orders_dir().rglob(f'{order_id}.json'):
        return p
    return None


def _migrate_flat_orders() -> None:
    """One-time: move any data/orders/*.json flat files into yyyy/mm/dd/ subdirs."""
    orders_dir = get_orders_dir()
    for fp in list(orders_dir.glob('*.json')):
        if fp.name.startswith('_'):
            continue
        try:
            order = json.loads(fp.read_text(encoding='utf-8'))
            dest = _order_day_dir(order.get('createdAt', '')) / fp.name
            if not dest.exists():
                fp.rename(dest)
            else:
                fp.unlink()
        except Exception:
            pass


def get_users_dir() -> Path:
    users_dir = get_data_dir() / 'users'
    users_dir.mkdir(parents=True, exist_ok=True)
    return users_dir


# ── User ID sequence ─────────────────────────────────────────────────────────
# ID format: yyyyMMdd + 10-digit zero-padded sequence  e.g. 202605240000000001

def _seq_path() -> Path:
    return get_users_dir() / '_seq.json'


def _index_path() -> Path:
    return get_users_dir() / '_index.json'


def _next_user_id(date_str: str = '') -> str:
    """Allocate next user ID. date_str is YYYYMMDD; defaults to today."""
    from datetime import date as _date
    if not date_str:
        date_str = _date.today().strftime('%Y%m%d')
    seq_path = _seq_path()
    seq = 1
    if seq_path.exists():
        try:
            seq = json.loads(seq_path.read_text(encoding='utf-8')).get('seq', 0) + 1
        except Exception:
            pass
    seq_path.write_text(json.dumps({'seq': seq}), encoding='utf-8')
    return f'{date_str}{seq:010d}'


def _load_index() -> dict[str, str]:
    """phone → userId"""
    path = _index_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {}


def _save_index(index: dict[str, str]) -> None:
    _index_path().write_text(json.dumps(index, indent=2), encoding='utf-8')


def _email_index_path() -> Path:
    return get_users_dir() / '_email_index.json'


def _load_email_index() -> dict[str, str]:
    """email → userId"""
    path = _email_index_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {}


def _save_email_index(index: dict[str, str]) -> None:
    _email_index_path().write_text(json.dumps(index, indent=2), encoding='utf-8')


# ── User record helpers ──────────────────────────────────────────────────────

def _user_path_by_id(user_id: str) -> Path:
    return get_users_dir() / f'{user_id}.json'


def load_user_by_id(user_id: str) -> Optional[dict[str, Any]]:
    path = _user_path_by_id(user_id)
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return None


def load_user(phone: str) -> Optional[dict[str, Any]]:
    index = _load_index()
    user_id = index.get(phone)
    if not user_id:
        return None
    return load_user_by_id(user_id)


def load_user_by_email(email: str) -> Optional[dict[str, Any]]:
    email = email.strip().lower()
    index = _load_email_index()
    user_id = index.get(email)
    if not user_id:
        return None
    return load_user_by_id(user_id)


def save_user(user: dict[str, Any]) -> dict[str, Any]:
    user_id = user.get('id')
    if not user_id:
        raise ValueError('User must have an id before saving.')
    _user_path_by_id(user_id).write_text(json.dumps(user, indent=2), encoding='utf-8')
    # Sync phone index
    if user.get('phone'):
        index = _load_index()
        index[user['phone']] = user_id
        _save_index(index)
    # Sync email index
    emails = user.get('emails', [])
    if emails:
        ei = _load_email_index()
        for email in emails:
            ei[email.strip().lower()] = user_id
        _save_email_index(ei)
    return user


# ── PIN auth helpers ─────────────────────────────────────────────────────────

def _hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.strip().encode()).hexdigest()


def check_phone_exists(phone: str) -> dict[str, Any]:
    """Return {exists, hasPin} for the given phone."""
    user = load_user(phone)
    if user is None:
        return {'exists': False, 'hasPin': False}
    return {'exists': True, 'hasPin': bool(user.get('pinHash'))}


def verify_pin(phone: str, pin: str) -> Optional[dict[str, Any]]:
    """Return the user dict if PIN matches, else None."""
    user = load_user(phone)
    if user is None:
        return None
    stored = user.get('pinHash', '')
    if not stored or stored != _hash_pin(pin):
        return None
    return user


def set_user_pin(phone: str, pin: str) -> Optional[dict[str, Any]]:
    """Set (or update) the PIN for an existing user. Returns updated user or None."""
    user = load_user(phone)
    if user is None:
        return None
    user['pinHash'] = _hash_pin(pin)
    return save_user(user)


def clear_user_pin(phone: str) -> bool:
    """Clear PIN (admin reset). User will be prompted to set a new one on next login."""
    user = load_user(phone)
    if user is None:
        return False
    user.pop('pinHash', None)
    save_user(user)
    return True


def signup_user(phone: str, name: str, pin: str) -> dict[str, Any]:
    """Create a new user with a PIN. Raises ValueError if phone already exists."""
    if load_user(phone) is not None:
        raise ValueError('Phone already registered.')
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    date_prefix = datetime.now().strftime('%Y%m%d')
    new_id = _next_user_id(date_prefix)
    user: dict[str, Any] = {
        'id': new_id,
        'phone': phone,
        'name': name,
        'pinHash': _hash_pin(pin),
        'createdAt': now,
        'lastOrderAt': '',
        'orderCount': 0,
        'totalSpent': 0.0,
    }
    return save_user(user)


def social_login_or_create(email: str, name: str, picture: str = '') -> dict[str, Any]:
    """Find a user by email or create one. Returns the user dict."""
    email = email.strip().lower()
    existing = load_user_by_email(email)
    if existing is not None:
        # Freshen picture if provided
        if picture and existing.get('picture') != picture:
            existing['picture'] = picture
            save_user(existing)
        return existing
    # Create new social-only user (no phone, no PIN)
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    date_prefix = datetime.now().strftime('%Y%m%d')
    new_id = _next_user_id(date_prefix)
    user: dict[str, Any] = {
        'id': new_id,
        'name': name,
        'emails': [email],
        'picture': picture,
        'createdAt': now,
        'lastOrderAt': '',
        'orderCount': 0,
        'totalSpent': 0.0,
    }
    return save_user(user)


def link_email_to_user(user_id: str, email: str) -> tuple[Optional[dict[str, Any]], str]:
    """Add an email to an existing user. Returns (user, error_msg)."""
    email = email.strip().lower()
    # Check not already taken by another user
    existing_owner = load_user_by_email(email)
    if existing_owner is not None and existing_owner.get('id') != user_id:
        return None, 'This email is already linked to another account.'
    user = load_user_by_id(user_id)
    if user is None:
        return None, 'User not found.'
    emails = user.setdefault('emails', [])
    if email not in emails:
        emails.append(email)
        save_user(user)
    return user, ''


def link_phone_to_user(user_id: str, phone: str, pin: str) -> tuple[Optional[dict[str, Any]], str]:
    """Add a phone + PIN to an existing (social) user. Returns (user, error_msg)."""
    # Check not already taken by another user
    existing_owner = load_user(phone)
    if existing_owner is not None and existing_owner.get('id') != user_id:
        return None, 'This phone number is already linked to another account.'
    user = load_user_by_id(user_id)
    if user is None:
        return None, 'User not found.'
    user['phone'] = phone
    user['pinHash'] = _hash_pin(pin)
    save_user(user)
    return user, ''


def upsert_user_from_order(order: dict[str, Any]) -> None:
    """Create or update the user record in data/users/ from a single order."""
    phone = order.get('phone', '').strip()
    if not phone:
        return
    existing = load_user(phone)
    created_at = order.get('createdAt', '')
    total = order.get('total', 0.0)

    if existing is None:
        # Derive date prefix from order's createdAt
        date_prefix = created_at[:10].replace('-', '') if created_at else ''
        new_id = _next_user_id(date_prefix)
        save_user({
            'id': new_id,
            'phone': phone,
            'name': order.get('customerName', ''),
            'createdAt': created_at,
            'lastOrderAt': created_at,
            'orderCount': 1,
            'totalSpent': round(float(total), 2),
        })
    else:
        existing['orderCount'] = existing.get('orderCount', 0) + 1
        existing['totalSpent'] = round(existing.get('totalSpent', 0.0) + float(total), 2)
        if created_at > existing.get('lastOrderAt', ''):
            existing['lastOrderAt'] = created_at
            existing['name'] = order.get('customerName', existing['name'])
        save_user(existing)


def _migrate_users_from_orders() -> None:
    """One-time migration: build users/ from existing orders if the index is empty."""
    if _load_index():
        return  # Already migrated
    # Aggregate orders by phone, sorted oldest-first so IDs reflect join date
    aggregated: dict[str, dict[str, Any]] = {}
    for file_path in sorted(get_orders_dir().glob('*.json')):
        try:
            order = json.loads(file_path.read_text(encoding='utf-8'))
        except Exception:
            continue
        phone = order.get('phone', '').strip()
        if not phone:
            continue
        created = order.get('createdAt', '')
        total = float(order.get('total', 0.0))
        if phone not in aggregated:
            aggregated[phone] = {
                'phone': phone,
                'name': order.get('customerName', ''),
                'createdAt': created,
                'lastOrderAt': created,
                'orderCount': 0,
                'totalSpent': 0.0,
            }
        aggregated[phone]['orderCount'] += 1
        aggregated[phone]['totalSpent'] = round(aggregated[phone]['totalSpent'] + total, 2)
        if created > aggregated[phone]['lastOrderAt']:
            aggregated[phone]['lastOrderAt'] = created
            aggregated[phone]['name'] = order.get('customerName', aggregated[phone]['name'])
    # Assign IDs in order of first-seen (oldest createdAt first)
    for user in sorted(aggregated.values(), key=lambda u: u.get('createdAt', '')):
        date_prefix = user['createdAt'][:10].replace('-', '') if user.get('createdAt') else ''
        user['id'] = _next_user_id(date_prefix)
        save_user(user)


def list_users() -> list[dict[str, Any]]:
    """Return all users from data/users/, migrating from orders on first call."""
    _migrate_users_from_orders()
    # Scan all user JSON files (covers phone users, social-only users, and linked users)
    users_dir = get_users_dir()
    seen_ids: set[str] = set()
    users = []
    for path in users_dir.glob('*.json'):
        if path.name.startswith('_'):
            continue
        try:
            user = json.loads(path.read_text(encoding='utf-8'))
            uid = user.get('id', '')
            if uid and uid not in seen_ids:
                seen_ids.add(uid)
                users.append(user)
        except Exception:
            continue
    return sorted(users, key=lambda u: u.get('lastOrderAt', ''), reverse=True)


def list_orders() -> list[dict[str, Any]]:
    _migrate_flat_orders()
    orders: list[dict[str, Any]] = []
    for file_path in get_orders_dir().rglob('*.json'):
        if file_path.name.startswith('_'):
            continue
        try:
            with file_path.open('r', encoding='utf-8') as handle:
                orders.append(json.load(handle))
        except Exception:
            continue
    return sorted(orders, key=lambda order: order.get('createdAt', ''), reverse=True)


def get_order(order_id: str) -> Optional[dict[str, Any]]:
    _migrate_flat_orders()
    file_path = _find_order_file(order_id)
    if file_path is None:
        return None
    with file_path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def save_order(order: dict[str, Any]) -> dict[str, Any]:
    day_dir = _order_day_dir(order.get('createdAt', ''))
    file_path = day_dir / f"{order['id']}.json"
    with file_path.open('w', encoding='utf-8') as handle:
        json.dump(order, handle, indent=2)
    upsert_user_from_order(order)
    return order


def update_order(order_id: str, updates: dict[str, Any]) -> Optional[dict[str, Any]]:
    order = get_order(order_id)
    if order is None:
        return None
    order.update(updates)
    file_path = _find_order_file(order_id) or (_order_day_dir(order.get('createdAt', '')) / f"{order_id}.json")
    with file_path.open('w', encoding='utf-8') as handle:
        json.dump(order, handle, indent=2)
    return order


def avg_goat_prep_minutes() -> int:
    """Return average goat prep time (accepted→ready) from past orders, or the default."""
    diffs: list[float] = []
    for order in list_orders():
        if order.get('status') in ('Ready', 'Completed') and order.get('acceptedAt') and order.get('readyAt'):
            has_goat = any(item.get('id', '').startswith('g') for item in order.get('items', []))
            if has_goat:
                try:
                    from datetime import datetime
                    accepted = datetime.fromisoformat(order['acceptedAt'])
                    ready = datetime.fromisoformat(order['readyAt'])
                    diff = (ready - accepted).total_seconds() / 60
                    if 1 <= diff <= 300:
                        diffs.append(diff)
                except (ValueError, TypeError):
                    pass
    return round(sum(diffs) / len(diffs)) if diffs else load_settings().get('goatPrepMinutes', DEFAULT_GOAT_PREP_MINUTES)


# ── Admin management ────────────────────────────────────────────────────────

def get_admins_path() -> Path:
    return get_data_dir() / 'admins.json'


def load_admins() -> dict[str, Any]:
    """Return stored admin data (phones/emails lists, excluding builtins)."""
    path = get_admins_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {'phones': [], 'emails': []}


def save_admins(data: dict[str, Any]) -> None:
    path = get_admins_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')


def is_admin_phone(phone: str) -> bool:
    if phone in BUILTIN_ADMIN_PHONES:
        return True
    return phone in load_admins().get('phones', [])


def is_admin_email(email: str) -> bool:
    if ADMIN_EMAIL and email == ADMIN_EMAIL:
        return True
    return email in load_admins().get('emails', [])


# ── Data folder browser ──────────────────────────────────────────────────────

def browse_data_dir(rel_path: str = '') -> dict[str, Any]:
    """Browse a directory within the data dir. Returns entries with type, size, modified."""
    import time
    data_dir = get_data_dir().resolve()
    try:
        target = (data_dir / rel_path).resolve() if rel_path else data_dir
        target.relative_to(data_dir)  # safety check
    except (ValueError, Exception):
        return {'success': False, 'message': 'Invalid path.'}
    if not target.exists() or not target.is_dir():
        return {'success': False, 'message': 'Path not found.'}

    entries: list[dict[str, Any]] = []
    for p in sorted(target.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
        try:
            stat = p.stat()
            rel = str(p.relative_to(data_dir))
            entries.append({
                'name': p.name,
                'path': rel,
                'type': 'file' if p.is_file() else 'dir',
                'size': stat.st_size if p.is_file() else None,
                'modified': stat.st_mtime,
            })
        except Exception:
            continue

    current = str(target.relative_to(data_dir)) if target != data_dir else ''
    return {
        'success': True,
        'dataDir': str(data_dir),
        'currentPath': current,
        'entries': entries,
    }


def list_data_files() -> list[dict[str, Any]]:
    """List all files under the data directory (relative paths). Legacy flat list."""
    data_dir = get_data_dir()
    result: list[dict[str, Any]] = []
    if not data_dir.exists():
        return result
    for p in sorted(data_dir.rglob('*')):
        if p.is_file():
            stat = p.stat()
            result.append({
                'path': str(p.relative_to(data_dir)),
                'size': stat.st_size,
            })
    return result


def read_data_file(rel_path: str) -> Optional[str]:
    """Read a file within the data directory. Returns None if unsafe/missing."""
    data_dir = get_data_dir().resolve()
    try:
        target = (data_dir / rel_path).resolve()
        target.relative_to(data_dir)  # raises ValueError if outside data_dir
    except (ValueError, Exception):
        return None
    if not target.is_file():
        return None
    try:
        return target.read_text(encoding='utf-8')
    except Exception:
        return None


def suggested_prep_minutes(items: list[dict[str, Any]]) -> int:
    """Calculate suggested prep time based on item categories."""
    settings = load_settings()
    has_goat = any(item.get('id', '').startswith('g') for item in items)
    has_chicken = any(item.get('id', '').startswith('c') for item in items)
    times = []
    if has_chicken:
        times.append(settings['chickenPrepMinutes'])
    if has_goat:
        times.append(avg_goat_prep_minutes())
    return max(times) if times else settings['chickenPrepMinutes']


# ── Menu management ──────────────────────────────────────────────────────────

def get_menu_path() -> Path:
    return get_data_dir() / 'menu.json'


def load_menu() -> list[dict[str, Any]]:
    """Load menu from file, falling back to DEFAULT_MENU."""
    path = get_menu_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return [item.copy() for item in DEFAULT_MENU]


def save_menu(menu: list[dict[str, Any]]) -> None:
    path = get_menu_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(menu, indent=2), encoding='utf-8')


def update_menu_item(item_id: str, updates: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Update a single menu item by id. Returns the updated item or None if not found."""
    menu = load_menu()
    for item in menu:
        if item['id'] == item_id:
            allowed = {'name', 'price', 'unit', 'description', 'category'}
            for key, val in updates.items():
                if key in allowed:
                    item[key] = val
            save_menu(menu)
            return item
    return None


def delete_menu_item(item_id: str) -> bool:
    """Delete a menu item by id. Returns True if deleted, False if not found."""
    menu = load_menu()
    new_menu = [item for item in menu if item['id'] != item_id]
    if len(new_menu) == len(menu):
        return False
    save_menu(new_menu)
    return True


def add_menu_item(item: dict[str, Any]) -> dict[str, Any]:
    """Append a new menu item, generating a unique id."""
    from uuid import uuid4
    menu = load_menu()
    new_item: dict[str, Any] = {
        'id': str(uuid4())[:8],
        'category': item['category'],
        'name': item['name'],
        'price': round(float(item['price']), 2),
        'unit': item.get('unit', ''),
        'description': item.get('description', ''),
    }
    menu.append(new_item)
    save_menu(menu)
    return new_item


# ── Location / Hours management ──────────────────────────────────────────────

# Hours: dict keyed by weekday string "0"=Sun … "6"=Sat.
# Each value: {"open": "10:00", "close": "20:00"} or null for closed.
DEFAULT_LOCATIONS: list[dict] = [
    {
        'id': 'loc1',
        'name': 'Monroe Township',
        'address': '355 Applegarth Rd, Monroe Township, NJ 08831',
        'phone': '(609) 235-9158',
        'deliveryMode': 'pickup',
        'hours': {
            '0': {'open': '10:00', 'close': '18:00'},
            '1': {'open': '10:00', 'close': '20:00'},
            '2': {'open': '10:00', 'close': '20:00'},
            '3': {'open': '10:00', 'close': '20:00'},
            '4': {'open': '10:00', 'close': '20:00'},
            '5': {'open': '10:00', 'close': '20:00'},
            '6': {'open': '10:00', 'close': '20:00'},
        },
    },
    {
        'id': 'loc2',
        'name': 'Location 2',
        'address': 'Address TBD — update in Admin',
        'phone': '',
        'deliveryMode': 'hourly_delivery',
        'hours': {
            '0': {'open': '10:00', 'close': '18:00'},
            '1': {'open': '10:00', 'close': '20:00'},
            '2': {'open': '10:00', 'close': '20:00'},
            '3': {'open': '10:00', 'close': '20:00'},
            '4': {'open': '10:00', 'close': '20:00'},
            '5': {'open': '10:00', 'close': '20:00'},
            '6': {'open': '10:00', 'close': '20:00'},
        },
    },
]


def get_locations_path() -> Path:
    return get_data_dir() / 'locations.json'


def load_locations() -> list[dict[str, Any]]:
    path = get_locations_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return [loc.copy() for loc in DEFAULT_LOCATIONS]


def save_locations(locations: list[dict[str, Any]]) -> None:
    path = get_locations_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(locations, indent=2), encoding='utf-8')


def add_location(loc: dict[str, Any]) -> dict[str, Any]:
    from uuid import uuid4
    locations = load_locations()
    new_loc: dict[str, Any] = {
        'id': 'loc' + str(uuid4())[:6],
        'name': loc.get('name', 'New Location'),
        'address': loc.get('address', ''),
        'phone': loc.get('phone', ''),
        'hours': loc.get('hours', DEFAULT_LOCATIONS[0]['hours'].copy()),
    }
    locations.append(new_loc)
    save_locations(locations)
    return new_loc


def update_location(loc_id: str, updates: dict[str, Any]) -> Optional[dict[str, Any]]:
    locations = load_locations()
    for loc in locations:
        if loc['id'] == loc_id:
            for key in ('name', 'address', 'phone', 'hours', 'deliveryMode'):
                if key in updates:
                    loc[key] = updates[key]
            save_locations(locations)
            return loc
    return None


def delete_location(loc_id: str) -> bool:
    locations = load_locations()
    new_locs = [loc for loc in locations if loc['id'] != loc_id]
    if len(new_locs) == len(locations):
        return False
    save_locations(new_locs)
    return True


# ── Settings management ───────────────────────────────────────────────────────

DEFAULT_SETTINGS: dict[str, Any] = {
    'chickenPrepMinutes': CHICKEN_PREP_MINUTES,
    'goatPrepMinutes': DEFAULT_GOAT_PREP_MINUTES,
    'deletePin': '1234567',
}


def get_settings_path() -> Path:
    return get_data_dir() / 'settings.json'


def load_settings() -> dict[str, Any]:
    """Load app settings from file, merging with defaults."""
    path = get_settings_path()
    if path.exists():
        try:
            stored = json.loads(path.read_text(encoding='utf-8'))
            return {**DEFAULT_SETTINGS, **stored}
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def save_settings(settings: dict[str, Any]) -> None:
    path = get_settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(settings, indent=2), encoding='utf-8')
