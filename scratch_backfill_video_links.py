import sys
sys.path.insert(0, 'backend')
import asyncio
from app.database.session import get_session_factory
from app.database.models import Task, VideoFile
from sqlalchemy import select, desc

async def main():
    factory = get_session_factory()
    async with factory() as session:
        tasks = (await session.execute(select(Task))).scalars().all()
        updated_count = 0
        for t in tasks:
            # Check if VideoFile exists for this task
            stmt = select(VideoFile).where(VideoFile.event_id == t.id).order_by(desc(VideoFile.created_at)).limit(1)
            vf = (await session.execute(stmt)).scalar_one_or_none()
            if vf:
                v_cfg = dict(t.video_config or {})
                v_cfg["source_type"] = "FILE"
                v_cfg["video_id"] = vf.id
                v_cfg["stored_path"] = vf.stored_path
                v_cfg["stored_filename"] = vf.stored_path.split('\\')[-1].split('/')[-1]
                v_cfg["original_filename"] = vf.original_filename
                v_cfg["filename"] = vf.original_filename
                v_cfg["playback_url"] = f"/api/videos/{vf.id}/stream"
                v_cfg["stream_url"] = f"/api/tasks/{t.id}/video/stream"
                v_cfg["fps"] = vf.fps
                v_cfg["duration_seconds"] = vf.duration_seconds
                v_cfg["width"] = vf.width
                v_cfg["height"] = vf.height
                t.video_config = v_cfg
                updated_count += 1
                print(f"Linked task '{t.name}' ({t.id}) to video '{vf.original_filename}' ({vf.id})")
        if updated_count > 0:
            await session.commit()
            print(f"Successfully committed updates for {updated_count} task(s).")
        else:
            print("No tasks required updating.")

if __name__ == '__main__':
    asyncio.run(main())
