"""v6 performance indexes

Revision ID: f6a4d0b2c901
Revises: dc7854073a94
Create Date: 2026-03-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f6a4d0b2c901'
down_revision: Union[str, None] = 'dc7854073a94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create indexes only if they don't already exist (safe for re-runs)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_payment_client_status
        ON payment_requests (client_id, status)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_payment_worker_status
        ON payment_requests (worker_id, client_id, status)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_payment_staff_status
        ON payment_requests (locked_by_staff_id, status)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_payment_completed_at
        ON payment_requests (completed_at)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_balancelog_client
        ON balance_logs (added_by_client_id)
    """)


def downgrade() -> None:
    op.drop_index('ix_balancelog_client', table_name='balance_logs')
    op.drop_index('ix_payment_completed_at', table_name='payment_requests')
    op.drop_index('ix_payment_staff_status', table_name='payment_requests')
    op.drop_index('ix_payment_worker_status', table_name='payment_requests')
    op.drop_index('ix_payment_client_status', table_name='payment_requests')
