"""add last_message_preview to conversations

Revision ID: 7c7d0c07c7b7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-21 22:31:42.671756

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c7d0c07c7b7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('conversations', sa.Column('last_message_preview', sa.String(), nullable=True))
    
    # Popular dados retroativos de preview
    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)
    
    try:
        conversations = session.execute(sa.text("SELECT id FROM conversations")).fetchall()
        for conv in conversations:
            conv_id = conv[0]
            # Busca a última mensagem daquela conversa ordenada por created_at desc
            last_msg = session.execute(
                sa.text("SELECT message_type, content, is_internal FROM messages WHERE conversation_id = :conv_id ORDER BY created_at DESC, id DESC LIMIT 1"),
                {"conv_id": conv_id}
            ).fetchone()
            
            if last_msg:
                msg_type, msg_content, is_internal = last_msg[0], last_msg[1], bool(last_msg[2])
                
                preview = ""
                if is_internal:
                    preview = f"📝 Nota: {msg_content or ''}"
                elif msg_type == "text":
                    preview = msg_content or ""
                elif msg_type == "image":
                    preview = f"📷 Foto{': ' + msg_content if msg_content else ''}"
                elif msg_type == "video":
                    preview = f"🎥 Vídeo{': ' + msg_content if msg_content else ''}"
                elif msg_type == "audio":
                    preview = "🎤 Áudio"
                elif msg_type == "document":
                    preview = f"📄 Documento{': ' + msg_content if msg_content else ''}"
                else:
                    preview = msg_content or ""
                
                session.execute(
                    sa.text("UPDATE conversations SET last_message_preview = :preview WHERE id = :conv_id"),
                    {"preview": preview, "conv_id": conv_id}
                )
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Error migrating retroactive last_message_previews: {e}")
    finally:
        session.close()


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('conversations', 'last_message_preview')
