from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Test if variables are loaded correctly
print("Environment variables loaded successfully!")
print(f"DATABASE_URL: {os.getenv('DATABASE_URL')}")
print(f"LANGSMITH_API_KEY: {os.getenv('LANGSMITH_API_KEY')[:20]}...") # Only show first 20 chars for security
print(f"OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY')[:20]}...")
print(f"MISTRAL_API_KEY: {os.getenv('MISTRAL_API_KEY')[:20]}...")
