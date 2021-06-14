from deta import App
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Template
from note import *


fast = FastAPI()

app = App(fast)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def landing_page():
    return "knotro.com - try it out at `/playground` !"

@app.get("/playground")
def html_handler():
    note_template = Template((open("playground.html").read()))
    note_css = open("style.css").read()
    js = open("playground.js").read()
    return HTMLResponse(note_template.render(playground_js=js, css=note_css))