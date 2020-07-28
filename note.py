import os
import base64
import bleach
from pydantic import BaseModel
from deta import Deta

def base_wrapper(name):
  deta = Deta(os.environ["DETA_PROJECT_KEY"])
  return deta.Base(name)

notes = base_wrapper("notes")

base_url = "https://" + os.environ["DETA_PATH"] + ".deta.dev/"

default_content = f"## Info:\n\nThis is a \"box\" of notes. \n\nEvery note has a  url at: `{base_url}notes/:note_name`\n\nThe notes are also accessible via API:\n\n`GET {base_url}notes/:note_name?json=true`\n\nAnyone with **run access** can edit and view the note.\n\nYou can edit notes using the **edit** button, writing regular markdown.\n\nYou can [[link]] to any note in your box using the convention **[[~note_name]]**.\n- This creates bi-directional links. \n\nA list of all notes that link to the present note are under a header **Backlinks**.\n \n\n"


def list_diff(list_one, list_two):
    diff_list = [x for x in list_one if x not in list_two]
    return diff_list


class Note(BaseModel):
    name: str
    content: str = default_content
    links: list = []
    backlinks: list = []


class Links(BaseModel):
    links: list = []


def urlsafe_key(note_name):
    return base64.b64encode(note_name.encode('ascii')).decode('ascii').replace("=", "_")


# db operations
def fetch_notes(term):
    my_notes = next(notes.fetch([{"name?contains": term}, {"content?contains": term}]))
    links = [d["name"] for d in my_notes]
    return links

# get note, transform if empty lists
def get_note(note_name):
    note_key = urlsafe_key(note_name)
    note_dict = notes.get(note_key)

    if not note_dict:
        return None

    checks = ["links", "backlinks"] # db can't store empty lists ??

    for each in checks:
      if not note_dict[each]:
        note_dict[each] = []

    return Note(**note_dict)


# update note with new info  
def db_update_note(note: Note):
    note_dict = note.dict()
    note_dict["content"] = bleach.clean(note_dict["content"])
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
        return db_update_note(note)

      else:
        backlinks = [backlink]
        note = Note(name=note_name, backlinks=backlinks)
        return db_update_note(note)