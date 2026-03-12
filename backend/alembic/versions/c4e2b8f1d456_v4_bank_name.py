"""V4 add bank_name to workers

Revision ID: c4e2b8f1d456
Revises: b3f2a7e9d123
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c4e2b8f1d456'
down_revision: Union[str, Sequence[str], None] = 'b3f2a7e9d123'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('workers', sa.Column('bank_name', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('workers', 'bank_name')
