import os, random
import base64
from datetime import datetime, timezone
import bleach
from pydantic import BaseModel
from deta import Deta


deta = Deta()

notes = deta.Base("knotro_notes")

base_url = "/"

default_content = ["have the curiosity to open the Door in the Wall...", 
"come back through the Door in the Wall, not quite the same, humbler yet better equipped...",
"that's all the motorcycle is, a system of concepts worked out in steel...",
f"For the game of creation, a sacred \"Yes\" is needed...",
"one cannot fly into flying...",
"where is your way...",
"try Cmd/Ctrl + i to change the view...",
"try Cmd/Ctrl + j to toggle focus mode..."]

if not os.getenv("DETA_SPACE_APP") and os.getenv("DETA_RUNTIME"):
    base_url = "https://" + os.environ["DETA_PATH"] + ".deta.dev/"


def list_diff(list_one, list_two):
    diff_list = [x for x in list_one if x not in list_two]
    return diff_list

def get_all(db, query):
    blob_gen = db.fetch(query)
    blobs = []
    for stored_blob in blob_gen:
        for blob in stored_blob:
            blob["id"] = blob["key"]
            del blob["key"]
            blobs.append(blob)
    return blobs

class Note(BaseModel):
    name: str
    content: str
    links: list = []
    backlinks: list = []
    last_modified: str = str(datetime.now(timezone.utc).isoformat())
    is_public: bool = False
    recent_index: float = datetime.utcnow().timestamp()

class Links(BaseModel):
    links: list = []

class NoteStatus(BaseModel):
    is_public: bool = False

def urlsafe_key(note_name):
    return base64.b64encode(note_name.encode('ascii')).decode('ascii').replace("=", "_")

# db operations
def fetch_notes(term):
    my_notes = next(notes.fetch(
        [{"name?contains": term}, {"content?contains": term}]))
    links = [d["name"] for d in my_notes]
    return links

def recent_notes():
    recent_notes = get_all(notes, {})
    recent_notes.sort(key=lambda x: x["recent_index"], reverse=True)
    recent_notes = [each["name"] for each in recent_notes]
    return recent_notes[:10]

# get note, transform if empty lists
def get_note(note_name):
    note_key = urlsafe_key(note_name)
    print(note_key)
    note_dict = notes.get(note_key)

    if not note_dict:
        return None

    list_checks = ["links", "backlinks"]  # db can't store empty lists, fix db

    for each in list_checks:
        if not note_dict[each]:
            note_dict[each] = []
    
    if not note_dict["content"]:
        note_dict["content"] = ""
    
    return Note(**note_dict)


# update note with new info
def db_update_note(note: Note):
    note_dict = note.dict()
    note_dict["content"] = bleach.clean(note_dict["content"])
    note_dict["last_modified"] = str(datetime.now(timezone.utc).isoformat())
    note_dict["recent_index"] = datetime.utcnow().timestamp()
    notes.put(note_dict, urlsafe_key(note.name))
    return Note(**note_dict)

# remove a backlink from a note
def remove_backlink(note_name, backlink):
    note = get_note(note_name)
    try:
        note.backlinks.remove(backlink)
    except ValueError:
        pass
    return db_update_note(note)


# add a backlink to a new note, if non-existent, create
def add_backlink_or_create(note_name, backlink):
    note = get_note(note_name)

    if note:
        note.backlinks.append(backlink)
        unique_backlinks = set(note.backlinks)
        note.backlinks = list(unique_backlinks)
        return db_update_note(note)
        
    else:
        backlinks = [backlink]
        note = Note(name=note_name, backlinks=backlinks, content=random.choice(default_content))
        return db_update_note(note)


def modify_public_status(note_name, is_public):
    note = get_note(note_name)
    if note:
        note.is_public = is_public
        return db_update_note(note)
    else:
        return None
        
