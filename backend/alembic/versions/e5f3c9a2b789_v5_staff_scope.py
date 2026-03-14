"""v5 staff scope

Revision ID: e5f3c9a2b789
Revises: c4e2b8f1d456
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5f3c9a2b789'
down_revision: Union[str, None] = 'c4e2b8f1d456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('staff_scope', sa.String(), nullable=False, server_default='own_client'))


def downgrade() -> None:
    op.drop_column('users', 'staff_scope')
