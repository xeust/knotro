## yarc

![yarc](assets/yarc.png)

### General Info

*yarc* gives you a "box" of notes. It is a minimal micro-homage to the bi-directional linking in tools like [Roam Research](https://roamresearch.com/).

Every note has a url at: `:base_url/notes/:note_name`

The notes are also accessible via API:

`GET :base_url/notes/:note_name?json=true`

You can edit notes using the **edit** button, writing regular markdown. 

You can [[link]] to any note in your box using the convention **[[~note_name]]**.
- This creates bi-directional links. 

A list of all notes that link to the present note are under a header **Backlinks**.

The home page lets one search for or go to notes.


### Deploying

My instance of yarc is currently running on [Deta](https://www.deta.sh/).

It could, with little modification, be configured to run elsewhere; a database is needed.

#### On Deta
Clone the GitHub repo.

Login to the [Deta](https://web.deta.sh/) web app, and a 'default project' will be created.

Install the [Deta CLI](https://docs.deta.sh/docs/cli/install) and use 3 commands from within the yarc directory:

```
deta login
```

```
deta new
```

```
deta deploy
```

You're copy of *yarc* should be live for personal use.

### Libraries Used

- [FastAPI](https://fastapi.tiangolo.com/)
- [Jinja2](https://jinja.palletsprojects.com/en/2.11.x/)
- [Bleach](https://bleach.readthedocs.io/en/latest/clean.html)
- [Deta](https://www.deta.sh/)
- [hyperapp](https://github.com/jorgebucaran/hyperapp)
- [Showdown](http://showdownjs.com/)
- [CodeJar](https://github.com/antonmedv/codejar)
- [highlightjs](https://highlightjs.org/usage/)
