"""V3 balance, session, balance_logs

Revision ID: b3f2a7e9d123
Revises: a5c1de8c77cd
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b3f2a7e9d123'
down_revision: Union[str, Sequence[str], None] = 'a5c1de8c77cd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add available_balance and session_id to users
    op.add_column('users', sa.Column('available_balance', sa.Float(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('session_id', sa.String(), nullable=True))

    # Create balance_logs table
    op.create_table(
        'balance_logs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('staff_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('added_by_client_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('balance_after', sa.Float(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('balance_logs')
    op.drop_column('users', 'session_id')
    op.drop_column('users', 'available_balance')
