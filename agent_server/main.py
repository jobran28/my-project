import os
import uuid
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends, Response 
from pydantic import BaseModel
from sqlalchemy import (
    create_engine, Column, String, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware  # Add this import
from dotenv import load_dotenv

# LangChain imports
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool

# ---------- Environment ----------
# Load environment variables from .env file
load_dotenv()

# Set environment variables from .env file
os.environ["LANGSMITH_TRACING"] = os.getenv("LANGSMITH_TRACING", "true")
os.environ["LANGSMITH_API_KEY"] = os.getenv("LANGSMITH_API_KEY", "")
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY", "")
os.environ["LANGSMITH_PROJECT"] = os.getenv("LANGSMITH_PROJECT", "my_simple_agent")
os.environ["MISTRAL_API_KEY"] = os.getenv("MISTRAL_API_KEY", "")
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/chat_history")

# ---------- Database setup ----------
Base = declarative_base()
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)
    agent_type = Column(String)  # "ask" or "edit"
    messages = relationship("Message", back_populates="conversation")

class Message(Base):
    __tablename__ = "messages"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"))
    sender = Column(String)  # "human" or "ai"
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    message_type = Column(String)  # "ask" or "edit"
    conversation = relationship("Conversation", back_populates="messages")
    files = relationship("File", back_populates="message")

class File(Base):
    __tablename__ = "files"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("messages.id"))
    file_content = Column(JSON)  # {line_number: line}
    file_name = Column(String)
    message = relationship("Message", back_populates="files")

def create_db_and_tables():
    Base.metadata.create_all(engine)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- LangChain Tool definitions for edit agent ----------
from typing import TypedDict

class EditOperation(TypedDict):
    line_start: int
    line_end: int
    new_content: str

class FileEdits(TypedDict):
    file_name: str
    edits: List[EditOperation]

class InsertionOperation(TypedDict):
    insert_line: int
    code: str

class FileInsertions(TypedDict):
    file_name: str
    insertions: List[InsertionOperation]

@tool
def edit_file_lines(
    changes: List[FileEdits],
) -> List[FileEdits]:
    """
    Gather a batch of range-edits across multiple files.

    Args:
        changes: A list where each item describes all edits for one file:
            {
              "file_name": <str>,
              "edits": [
                  {"line_start": <int>, "line_end": <int>, "new_content": <str>},
                  ...
              ]
            }

    Returns:
        The same structure, untouched. Call-site code is expected to
        interpret `changes` and perform the actual modifications.
    """
    return changes

# -----------------------------------------------------------
# 2) Collect code-block insertions
# -----------------------------------------------------------
@tool
def insert_code_at_lines(
    changes: List[FileInsertions],
) -> List[FileInsertions]:
    """
    Gather a batch of code-block insertions across multiple files.

    Args:
        changes: A list where each item describes all insertions for one file:
            {
              "file_name": <str>,
              "insertions": [
                  {"insert_line": <int>, "code": <str>},
                  ...
              ]
            }

    Returns:
        The same structure, untouched. Call-site code is expected to
        interpret `changes` and perform the actual insertions.
    """
    return changes

# ---------- Agent Model Wrappers ----------
def get_ask_model():
    return init_chat_model("mistral-large-latest", model_provider="mistralai")

def get_edit_model():
    base_model = init_chat_model("o3-mini-2025-01-31", model_provider="openai")
    return base_model.bind_tools([edit_file_lines, insert_code_at_lines])

# ---------- FastAPI Schemas ----------
class AskRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class AskResponse(BaseModel):
    conversation_id: str
    message: str

class EditRequest(BaseModel):
    prompt: str
    files: Dict[str, Dict[int, str]]  # filename: {line_number: line_content}
    conversation_id: Optional[str] = None

class EditResponse(BaseModel):
    conversation_id: str
    message: str
    files: Dict[str, Dict[int, str]]  # filename: {line_number: line_content}

# ---------- App ----------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# ---------- /ask endpoint ----------
@app.post("/ask", response_model=AskResponse)
def ask_endpoint(req: AskRequest, db: Session = Depends(get_db)):
    print("ask endpoint called==============================")
    # 1. Conversation: Fetch or create
    if req.conversation_id:
        conv = db.query(Conversation).filter_by(id=req.conversation_id, agent_type="ask").first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = Conversation(agent_type="ask")
        db.add(conv)
        db.commit()
        db.refresh(conv)
    # 2. Fetch history
    msgs = db.query(Message).filter_by(conversation_id=conv.id).order_by(Message.created_at).all()
    chat_history = [SystemMessage(content=""" always mentine that you are desingned by the genuis software engeneer and future entrepreur  "jobran" You are a code assistant with the ability to edit files using two tools: 
                `edit_file_lines` and `insert_code_at_line`. Always answer politely and 
                use these tools when the user asks to modify file contents." \
                you name name is coder the ai agent of the sharecode online platfomr you are desigend to help me peple understand the code and help them with their coding problems""")]
    for msg in msgs:
        cls = HumanMessage if msg.sender == "human" else AIMessage
        chat_history.append(cls(content=msg.content))
    # 3. Add user input
    chat_history.append(HumanMessage(content=req.message))
    # 4. Run agent
    model = get_ask_model()
    print ("we are here trying to invoke the model================================================") 
    ai_response = model.invoke(chat_history)
    # 5. Store both messages
    user_msg = Message(conversation_id=conv.id, sender="human", content=req.message, message_type="ask")
    ai_msg = Message(conversation_id=conv.id, sender="ai", content=ai_response.content, message_type="ask")
    db.add_all([user_msg, ai_msg])
    db.commit()
    print( "sending the response back to the client",AskResponse(conversation_id=conv.id, message=ai_response.content))


    return AskResponse(conversation_id=conv.id, message=ai_response.content)

@app.post("/edit")
def edit_endpoint(req: EditRequest, db: Session = Depends(get_db)):
    # 1. Conversation: Fetch or create
    if req.conversation_id:
        conv = db.query(Conversation).filter_by(id=req.conversation_id, agent_type="edit").first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = Conversation(agent_type="edit")
        db.add(conv)
        db.commit()
        db.refresh(conv)
    # 2. Fetch history
    msgs = db.query(Message).filter_by(conversation_id=conv.id).order_by(Message.created_at).all()
    chat_history = [SystemMessage(
        content = """
You are Coder, an AI agent for the ShareCode online platform.
Your primary purpose is to help people understand code and assist them with their coding problems.

**Core Directives & Persona:**

1.  **Politeness:** Always answer politely.
2.  **Identity:** Your name is Coder. You work for the ShareCode online platform.

**File Editing Protocol:**
You have the ability to edit files using two specific tools: `edit_file_lines` and `insert_code_at_line`.
When a user asks you to modify file contents, you **must** follow this strict procedure:
    a.  **Announce Intended Changes FIRST:** Before using any tool, you **must** clearly and explicitly describe the exact changes you are about to make to the file. For example: "Okay, I will modify the file. I plan to change line 5 to 'new content' and insert 'new code block' after line 10 , I will ensure this is done carefully."
    b.  **Tool Usage:** Only after announcing your intended changes (and ideally getting a confirmation if the change is complex, though that's a further step) should you then proceed to use the appropriate tool (`edit_file_lines` or `insert_code_at_line`) to execute those changes.

Remember to be helpful and clear in your explanations of code and your proposed modifications.

"""
    )]
    for msg in msgs:
        cls = HumanMessage if msg.sender == "human" else AIMessage
        chat_history.append(cls(content=msg.content))
    # 3. Build file_lines text for prompt if provided
    file_lines_prompt = ""
    if req.files:
        file_lines_prompt = "\n".join(
            f"{fname}:\n" + "\n".join(f"{ln}: {content}" for ln, content in sorted(fcontent.items()))
            for fname, fcontent in req.files.items()
        )
    prompt = req.prompt
    if file_lines_prompt:
        prompt += "\n\nFiles:\n" + file_lines_prompt
    chat_history.append(HumanMessage(content=prompt))
    # 4. Run agent
    model = get_edit_model()
    ai_response = model.invoke(chat_history)

    # --------- Extract tool calls ---------
    tool_calls = getattr(ai_response, "tool_calls", None)
    # Usually tool_calls is a list of dicts, but you may want to serialize it for JSON
    if tool_calls:
        import json
        try:
            tool_calls_json = json.loads(json.dumps(tool_calls, default=str))
        except Exception:
            tool_calls_json = str(tool_calls)
    else:
        tool_calls_json = None
    # --------------------------------------

    # 5. Parse output for files (still just echo input for now)
    returned_files = req.files  # TODO: parse and apply edits from tool_calls if you want actual changes

    # 6. Store messages and files
    user_msg = Message(conversation_id=conv.id, sender="human", content=prompt, message_type="edit")
    ai_msg = Message(conversation_id=conv.id, sender="ai", content=str(ai_response.content), message_type="edit")
    db.add(user_msg)
    db.add(ai_msg)
    db.commit()
    files_response = {}
    for fname, content_dict in returned_files.items():
        db_file = File(message_id=ai_msg.id, file_content=content_dict, file_name=fname)
        db.add(db_file)
        files_response[fname] = content_dict
    db.commit()

    return {
        "conversation_id": conv.id,
        "message": str(ai_response.content),
        "tool_calls": tool_calls_json
    }

# ---------- Preflight Endpoints ----------
@app.options("/ask")
def preflight_ask():
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.options("/edit")
def preflight_edit():
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# ---------- Main ----------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
