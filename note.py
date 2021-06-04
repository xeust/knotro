import os
import base64
import bleach
from pydantic import BaseModel
from deta import Deta
from datetime import datetime, timezone
deta = Deta()

notes = deta.Base("deta_notes")
drive_notes = deta.Drive("notes")

base_url = "/"

if not os.getenv("DETA_SPACE_APP"):
    base_url = "https://" + os.environ["DETA_PATH"] + ".deta.dev/"

default_content = f"## Info:\n\nThis is a \"box\" of notes. \n\nEvery note has a  url at: `{base_url}notes/:note_name`\n\nThe notes are also accessible via API:\n\n`GET {base_url}notes/:note_name?json=true`\n\nAnyone with **run access** can edit and view the note.\n\nYou can edit notes using the **edit** button, writing regular markdown.\n\nYou can [[link]] to any note in your box using the convention **[[~note_name]]**.\n- This creates bi-directional links. \n\nA list of all notes that link to the present note are under a header **Backlinks**.\n \n\n"


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
    content: str = default_content
    links: list = []
    backlinks: list = []
    last_modified: str = "12:00:PM"
    is_public: bool = False

class NoteMeta(BaseModel):
    name: str
    links: list = []
    backlinks: list = []
    last_modified: str
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
    note_dict = notes.get(note_key)

    if not note_dict:
        return None

    list_checks = ["links", "backlinks"]  # db can't store empty lists, fix db

    for each in list_checks:
        if not note_dict[each]:
            note_dict[each] = []

    note_content = drive_notes.get(note_name)
    if note_content:
        note_content = str(note_content.read(), 'ascii')
        note_dict["content"] = note_content

    if not note_dict["content"]:  # db can't store empty strings, fix db
        note_dict["content"] = ""

    return Note(**note_dict)

# update note with new info
def db_update_note(note: Note):
    note_dict = note.dict()
    note_dict["content"] = bleach.clean(note_dict["content"])

    drive_notes.put(note_dict["name"], str(note_dict["content"]))
    
    note_dict["last_modified"] = str(datetime.now(timezone.utc).isoformat())
    note_meta = NoteMeta(name=note_dict["name"], links=note_dict["links"],
                         backlinks=note_dict["backlinks"], last_modified=note_dict["last_modified"], is_public=note_dict["is_public"])
    notes.put(note_meta.dict(), urlsafe_key(note.name))
    
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
        return db_update_note(note)
    else:
        backlinks = [backlink]
        note = Note(name=note_name, backlinks=backlinks)
        return db_update_note(note)

def modify_public_status(note_name, is_public):
    note = get_note(note_name)
    if note:
        note.is_public = is_public
        return db_update_note(note)
    else:
        return None
        
