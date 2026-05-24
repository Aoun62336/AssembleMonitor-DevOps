import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User

async def seed_admin():
    engine = create_async_engine(str(settings.DATABASE_URL))
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check if admin already exists
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.email == "admin@assemble.com"))
        if result.scalar_one_or_none():
            print("Admin already exists.")
            return

        admin = User(
            email="admin@assemble.com",
            full_name="System Admin",
            hashed_password=hash_password("Admin@123"),
            role="admin",
            is_active=True
        )
        session.add(admin)
        await session.commit()
        print("Admin user created successfully!")
        print("Email: admin@assemble.com")
        print("Password: Admin@123")

if __name__ == "__main__":
    asyncio.run(seed_admin())
