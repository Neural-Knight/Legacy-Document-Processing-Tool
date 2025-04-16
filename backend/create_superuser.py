import asyncio
from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

async def create_superuser():
    db = SessionLocal()
    try:
        # Check if superuser already exists
        superuser = db.query(User).filter(User.email == "admin@example.com").first()
        if superuser:
            print("Superuser already exists.")
            return
            
        # Create new superuser
        superuser = User(
            email="admin@example.com",
            username="admin",
            hashed_password=get_password_hash("StrongAdminPassword123!"),
            first_name="Admin",
            last_name="User",
            is_active=True,
            is_superuser=True
        )
        db.add(superuser)
        db.commit()
        print("Superuser created successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(create_superuser())