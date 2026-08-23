"""live sessions

Revision ID: 002_live_sessions
Revises: 001_initial
Create Date: 2026-08-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_live_sessions"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "live_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("language", sa.String(length=16), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("recording_path", sa.String(length=512), nullable=True),
        sa.Column("recording_filename", sa.String(length=255), nullable=True),
        sa.Column("recording_content_type", sa.String(length=128), nullable=True),
        sa.Column("events", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_live_sessions_created_by"), "live_sessions", ["created_by"], unique=False)
    op.create_index(op.f("ix_live_sessions_status"), "live_sessions", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_live_sessions_status"), table_name="live_sessions")
    op.drop_index(op.f("ix_live_sessions_created_by"), table_name="live_sessions")
    op.drop_table("live_sessions")
