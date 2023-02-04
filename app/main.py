from note import *
from jinja2 import Template
from pydantic import BaseModel
from datetime import datetime, timezone
from fastapi import FastAPI, Response, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse


app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

default_content = ["have the curiosity to open the Door in the Wall...", 
"come back through the Door in the Wall, not quite the same, humbler yet better equipped...",
"that's all the motorcycle is, a system of concepts worked out in steel...",
f"For the game of creation, a sacred \"Yes\" is needed...",
"one cannot fly into flying...",
"where is your way...",
"try Cmd/Ctrl + i to change the view...",
"try Cmd/Ctrl + j to toggle focus mode..."]


@app.get("/")
def html_handler():
    return RedirectResponse(url=f'/notes#{datetime.now().strftime("%Y-%m-%d")}')
    
@app.get("/notes")
def notes_handler():
    note_template = Template((open("note.html").read()))
    note_css = open("style.css").read()
    note_js = open("note.js").read()
    return HTMLResponse(note_template.render(note_js=note_js, css=note_css))

@app.get("/search/{search_term}")
def search_handler(search_term: str):
    return fetch_notes(search_term)



#create notes or update backlinks server side if diff in links
@app.get("/notes/{note_name}")
async def read_note(note_name: str, json: bool = False):
    note = get_note(note_name)
    note_dict = {}
    if note:
      note_dict = note.dict()
    
    else:
      new_note = Note(name=note_name, content=random.choice(default_content))
      note_dict = new_note.dict()
      note_key = urlsafe_key(note_name)
      note_dict["last_modified"] = str(datetime.now(timezone.utc).isoformat())
      notes.put(note_dict, note_key)

    note_dict["base_url"] = base_url
    note_dict["recent_notes"] = recent_notes()
    
    return note_dict    

@app.get("/recents")
def read_recents():
    return recent_notes()

@app.get("/public/{note_name}")
async def read_public_note(note_name: str, json: bool = False):

    note = get_note(note_name)
    note_dict = {}

    if note and note.is_public:
      note_dict = note.dict()
    
    else:
        return FileResponse("./404.html")

    note_dict["base_url"] = base_url
    if json:
        return note_dict
    
    note_template = Template((open("public.html").read()))
    note_css = open("style.css").read()
    public_js = open("public.js").read()
    return HTMLResponse(note_template.render(note_data=note_dict, public_js=public_js, css=note_css))


@app.put("/{note_name}")
async def add_note(new_note: Note):
    old_note = get_note(new_note.name)
    old_links = old_note.links if old_note else []
    removed_links = list_diff(old_links, new_note.links)
    added_links = list_diff(new_note.links, old_links)

    for each in removed_links:
        if each != '':
            remove_backlink(each, new_note.name)

    db_update_note(new_note)

    for each in added_links:
        if each != '':
            add_backlink_or_create(each, new_note.name)
    
    return {"message": "success"}

@app.put("/make_public/{note_name}")
async def modify_public(note_name: str, note_status: NoteStatus):
    note = modify_public_status(note_name, note_status.is_public)

    if note:
        return {"message": "success"}
    else:
        return {"message":"failed"}