"""Server-side authorization scopes. Every read/write goes through these helpers."""

from dataclasses import dataclass, field

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.errors import AppError, forbidden
from app.models import HrAssignment, Unit, User


@dataclass
class Principal:
    user: User
    direct_report_ids: set[int]
    hr_unit_id: int | None
    # The HR unit and every unit under it.
    hr_unit_ids: set[int] = field(default_factory=set)

    @property
    def id(self) -> int:
        return self.user.id

    @property
    def is_commander(self) -> bool:
        return bool(self.direct_report_ids)

    @property
    def is_hr(self) -> bool:
        return self.hr_unit_id is not None


def load_principal(db: Session, user: User) -> Principal:
    direct = set(db.scalars(select(User.id).where(User.commander_id == user.id, User.is_active)).all())
    hr_unit_id = db.scalar(select(HrAssignment.unit_id).where(HrAssignment.user_id == user.id))
    hr_units = unit_subtree_ids(db, hr_unit_id) if hr_unit_id is not None else set()
    return Principal(user=user, direct_report_ids=direct, hr_unit_id=hr_unit_id, hr_unit_ids=hr_units)


def unit_subtree_ids(db: Session, unit_id: int) -> set[int]:
    """unit_id and all its descendant units (the unit hierarchy)."""
    rows = db.execute(
        text(
            """
            WITH RECURSIVE sub(id) AS (
                SELECT CAST(:uid AS integer)
                UNION
                SELECT u.id FROM units u JOIN sub s ON u.parent_id = s.id
            )
            SELECT id FROM sub
            """
        ),
        {"uid": unit_id},
    ).scalars()
    return set(rows)


def recursive_subordinate_ids(db: Session, commander_id: int) -> list[int]:
    """All transitive subordinates in the reporting hierarchy (not the unit hierarchy)."""
    rows = db.execute(
        text(
            """
            WITH RECURSIVE subs(id) AS (
                SELECT id FROM users WHERE commander_id = :cid AND is_active
                UNION
                SELECT u.id FROM users u JOIN subs s ON u.commander_id = s.id WHERE u.is_active
            )
            SELECT id FROM subs
            """
        ),
        {"cid": commander_id},
    ).scalars()
    return sorted(set(rows) - {commander_id})


def hr_unit_member_ids(db: Session, unit_id: int) -> set[int]:
    # HR scope is the assigned unit and all units under it.
    return set(db.scalars(select(User.id).where(User.unit_id.in_(unit_subtree_ids(db, unit_id)), User.is_active)).all())


def can_commander_manage(p: Principal, soldier_id: int) -> bool:
    return soldier_id in p.direct_report_ids


def can_hr_manage(db: Session, p: Principal, soldier_id: int) -> bool:
    if p.hr_unit_id is None:
        return False
    return db.scalar(select(User.unit_id).where(User.id == soldier_id)) in p.hr_unit_ids


def require_commander_of(p: Principal, soldier_id: int) -> None:
    if not can_commander_manage(p, soldier_id):
        raise forbidden("NOT_YOUR_SOLDIER")


def require_hr_of(db: Session, p: Principal, soldier_id: int) -> None:
    if not can_hr_manage(db, p, soldier_id):
        raise forbidden("NOT_IN_HR_UNIT")


def assert_no_unit_cycle(db: Session, unit_id: int, new_parent_id: int | None) -> None:
    """Raise if making new_parent_id the parent of unit_id would create a cycle."""
    current = new_parent_id
    seen: set[int] = set()
    while current is not None:
        if current == unit_id:
            raise AppError("UNIT_HIERARCHY_CYCLE", 409)
        if current in seen:  # pre-existing corruption; refuse to make it worse
            raise AppError("UNIT_HIERARCHY_CYCLE", 409)
        seen.add(current)
        current = db.scalar(select(Unit.parent_id).where(Unit.id == current))


def assert_no_commander_cycle(db: Session, user_id: int, new_commander_id: int | None) -> None:
    current = new_commander_id
    seen: set[int] = set()
    while current is not None:
        if current == user_id or current in seen:
            raise AppError("COMMAND_HIERARCHY_CYCLE", 409)
        seen.add(current)
        current = db.scalar(select(User.commander_id).where(User.id == current))


def set_unit_parent(db: Session, unit: Unit, parent_id: int | None) -> None:
    assert_no_unit_cycle(db, unit.id, parent_id)
    unit.parent_id = parent_id
