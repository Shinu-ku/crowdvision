import sys
sys.path.insert(0, 'backend')
import asyncio
from app.database.session import get_session_factory
from app.database.models import Task, VideoFile
from sqlalchemy import select

async def main():
    factory = get_session_factory()
    async with factory() as session:
        tasks = (await session.execute(select(Task))).scalars().all()
        print(f"Total tasks: {len(tasks)}")
        for t in tasks[-4:]:
            print(f"Task ID: {t.id} | Name: {t.name} | State: {t.state}")
            print(f"  video_config: {t.video_config}")
        
        videos = (await session.execute(select(VideoFile))).scalars().all()
        print(f"Total video files: {len(videos)}")
        for v in videos[-4:]:
            print(f"Video ID: {v.id} | Event ID: {v.event_id} | Original: {v.original_filename}")
            print(f"  stored_path: {v.stored_path}")

if __name__ == '__main__':
    asyncio.run(main())
