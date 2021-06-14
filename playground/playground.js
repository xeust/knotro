const converter = new showdown.Converter();
let jar;

// default values
const defaultContent =
  '## Info:\n\nThis is a "box" of notes. \n\nEvery note has a  url at: `https://zzygen.deta.dev/notes/:note_name`\n\nThe notes are also accessible via API:\n\n`GET https://zzygen.deta.dev/notes/:note_name?json=true`\n\nAnyone with **run access** can edit and view the note.\n\nYou can edit notes using the **edit** button, writing regular markdown.\n\nYou can [[link]] to any note in your box using the convention **[[~note_name]]**.\n- This creates bi-directional links. \n\nA list of all notes that link to the present note are under a header **Backlinks**.';

const defaultNote = {
  content: defaultContent,
  backlinks: [],
  last_modified: new Date().toISOString(),
  links: [],
  name: new Date().toLocaleDateString("fr-CA"),
  recent_notes: [],
};

// note api
const removeBacklink = (noteName, backlink) => {
  let note = JSON.parse(localStorage.getItem(noteName));
  if (note) {
    note.backlinks = note.backlinks.filter((link) => link != backlink);
    localStorage.setItem(noteName, JSON.stringify(note));
    return;
  }
};

const addBacklink = (noteName, backlink) => {
  let note = JSON.parse(localStorage.getItem(noteName));
  if (note) {
    note.backlinks.push(backlink);
    localStorage.setItem(noteName, JSON.stringify(note));
    return;
  } else {
    note = defaultNote;
    note.name = noteName;
    note.backlinks = [backlink];
    localStorage.setItem(noteName, JSON.stringify(note));
    return;
  }
};

const listDiff = (listOne, listTwo) => {
  let diffList = [];
  for (let each of listOne) {
    if (!listTwo.includes(each)) {
      diffList.push(each);
    }
  }
  diffList = new Set(diffList);
  diffList = Array.from(diffList);
  return diffList;
};

const updateLinks = (state) => {
  const oldNote = JSON.parse(localStorage.getItem(state.route));
  const oldLinks = oldNote ? oldNote.links : [];

  const removedLinks = listDiff(oldLinks, state.note.links);
  const addedLinks = listDiff(state.note.links, oldLinks);

  for (let each of removedLinks) {
    if (each != "") {
      removeBacklink(each, state.route);
    }
  }

  for (let each of addedLinks) {
    if (each != "") {
      addBacklink(each, state.route);
    }
  }

  const note = JSON.parse(localStorage.getItem(state.route));
  const updatedBacklinks = note ? note.backlinks : [];
  return updatedBacklinks;
};

const allNotes = () => {
  let notes = [];
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      notes.push(key);
    }
  }
  return notes;
};

const loadNote = (name) => {
  const localNote = JSON.parse(localStorage.getItem(name));
  if (localNote) {
    return {
      content: localNote.content,
      uniqueLinks: getUniqueLinks(localNote.content),
    };
  }
  return {
    content: defaultContent,
    uniqueLinks: getUniqueLinks(defaultContent),
  };
};

const recentNotes = (dispatch, options) => {
  const notes = [];
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      notes.push(JSON.parse(localStorage.getItem(key)));
    }
  }
  notes.sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified));
  const links = notes.map((note) => note.name);
  return links;
};

// helpers

const linkSub = (rawMD, links) => {
  let newMD = rawMD;
  for (const each of links) {
    let replacement;
    if (each[2] !== "~") {
      const bareName = each.substring(2, each.length - 2);
      replacement = `[${bareName}](#${encodeURI(bareName)})`;
    } else {
      // if the link is escaped with ~
      const bareName = each.substring(3, each.length - 2);
      replacement = `[[${bareName}]]`;
    }
    newMD = newMD.split(each).join(replacement);
  }
  return newMD;
};

const getUniqueLinks = (rawMD) => {
  const uniqueLinks = [...new Set(rawMD.match(/\[\[(.*?)\]]/g))];
  return uniqueLinks;
};

const getBareLinks = (rawMD) => {
  let markdown = rawMD;
  const uniqueLinks = getUniqueLinks(markdown);
  const bareLinks = uniqueLinks
    .map((each) => each.substring(2, each.length - 2))
    .filter((mappedEach) => mappedEach[0] !== "~");
  return bareLinks;
};

const getlastEdited = (lastModified) => {
  if (lastModified === "saving" || lastModified === "failed to save") {
    return lastModified;
  }
  const date = new Date(lastModified);

  let elapsed = Math.abs(new Date() - date) / 1000;

  const days = Math.floor(elapsed / 86400);
  elapsed -= days * 86400;

  // calculate hours
  const hours = Math.floor(elapsed / 3600) % 24;
  elapsed -= hours * 3600;

  // calculate minutes
  const minutes = Math.floor(elapsed / 60) % 60;
  elapsed -= minutes * 60;

  if (days < 1 || days === NaN) {
    if (hours < 1 || hours === NaN) {
      return `last edited: ${minutes} minutes ago`;
    } else {
      return `last edited: ${hours} hours ago`;
    }
  } else {
    return `last edited: ${days} days ago`;
  }
};

// routing
const _onhashchange = (dispatch, options) => {
  const handler = () => dispatch(options.action, location.hash);
  addEventListener("hashchange", handler);
  requestAnimationFrame(handler);
  return () => removeEventListener("hashchange", handler);
};

const onhashchange = (action) => [_onhashchange, { action }];
const HashHandler = (state, hash) => {
  const newState = {
    ...state,
    route:
      hash === "" ? new Date().toLocaleDateString("fr-CA") : hash.substring(1),
  };
  return [
    newState,
    [
      attachMarkdown,
      {
        state: newState,
        uniqueLinks: getUniqueLinks(state.note.content),
      },
    ],
  ];
};

// effects
const renderIcons = (dispatch, options) => {
  requestAnimationFrame(() => {
    feather.replace();
  });
};

const focusInput = (dispatch, options) => {
  requestAnimationFrame(() => {
    document.getElementById(options.id).focus();
  });
};

const attachCodeJar = (dispatch, options) => {
  requestAnimationFrame(() => {
    let timeout = null;
    var container = document.getElementById("container");
    container.innerHTML = "";
    jar = CodeMirror(container, {
      value: options.state.note.content,
      lineNumbers: false,
      lineWrapping: true,
      viewportMargin: Infinity,
      autoCloseBrackets: true,
      mode: "markdown",
    });

    jar.on("change", function (cm, change) {
      dispatch(
        options.UpdateContent(options.state, cm.getValue(), options.state.route)
      );
      if(!(jar.getTokenTypeAt(jar.getCursor()) === "link")) {
        clearTimeout(timeout);
        timeout = setTimeout(function () {
          dispatch(DebounceSave);
        }, 1500)
      }
    });
  });
};

const attachMarkdown = (dispatch, options) => {
  const { content, uniqueLinks } = loadNote(options.state.route);

  const convertedMarkdown = linkSub(content, uniqueLinks);
  const html = converter.makeHtml(convertedMarkdown);
  requestAnimationFrame(() => {
    const container = document.getElementById("container");
    container.innerHTML = html;
  });
  dispatch(UpdateContent(options.state, content, options.state.route));
};

const saveNote = (dispatch, options) => {
    dispatch(DebounceSave);
}

// actions

const DebounceSave = (state) => {
    const bareLinks = getBareLinks(state.note.content);
    const newState = {
      ...state,
      note: {
        ...state.note,
        last_modified: new Date().toISOString(),
        links: bareLinks,
      },
    };
    newState.note.backlinks = updateLinks(newState);
    localStorage.setItem(newState.note.name, JSON.stringify(newState.note));
    return [newState, [renderIcons]];
};


const UpdateContent = (state, newContent, newName) => {
  const bareLinks = getBareLinks(newContent);
  const note = JSON.parse(localStorage.getItem(newName));
  const recentLinks = recentNotes();
  const updatedBacklinks = note ? note.backlinks : [];
  const newState = {
    ...state,
    route: newName,
    note: {
      ...state.note,
      name: newName,
      content: newContent,
      last_modified: new Date().toISOString(),
      links: bareLinks,
      backlinks: updatedBacklinks,
      recent_notes: [newName, ...recentLinks.filter((name) => name != newName)],
    },
  };
  
  return [newState, [renderIcons]];
};



const Edit = (state) => {
  const newState = {
    ...state,
    view: "EDIT",
  };
  return [
    newState,
    [attachCodeJar, { state: newState, UpdateContent }],
    [renderIcons],
  ];
};

const View = (state) => {
  const note = JSON.parse(localStorage.getItem(state.route));
  const rawMD = note ? note.content : state.note.content;

  const bareLinks = getBareLinks(rawMD);
  const uniqueLinks = getUniqueLinks(rawMD);
  const recentLinks = recentNotes();
  const newState = {
    ...state,
    view: "VIEW",
    note: {
      ...state.note,
      last_modified: new Date().toUTCString(),
      content: rawMD,
      links: bareLinks,
      recent_notes: [
        state.note.name,
        ...recentLinks.filter((name) => name != state.note.name),
      ],
    },
  };
  return [
    newState,
    [attachMarkdown, { state: newState, uniqueLinks }],
    [saveNote, { state: newState }],
    [renderIcons],
  ];
};

const ToggleRight = (state) => {
  const newState = {
    ...state,
    showRight: !state.showRight,
    note: {
      ...state.note,
    },
  };

  return [newState, [renderIcons]];
};

const ToggleLeft = (state) => {
  const newState = {
    ...state,
    showLeft: !state.showLeft,
    note: {
      ...state.note,
    },
  };

  return [newState, [renderIcons]];
};

const UncollapseAndFocus = (state, type = "") => {
  const types = {
    ADD: {
      focusId: "new-input",
    },
    SEARCH: {
      focusId: "search-input",
    },
  };
  const newState = {
    ...state,
    showLeft: !state.showLeft,
    controls: {
      ...state.controls,
      active: type,
    },
    note: {
      ...state.note,
    },
  };
  const toFocus = types[type].focusId || "";
  return [
    newState,
    [renderIcons],
    toFocus ? [focusInput, { id: toFocus }] : null,
  ];
};

const searchNotes = async (dispatch, options) => {
  let notes = allNotes();
  const searchTerm = options.state.controls.SEARCH.inputValue;
  let links = [];
  for (const note of notes) {
    if (note.includes(searchTerm)) {
      links.push(note);
    }
  }
  console.log(notes, links, searchTerm);
  dispatch(UpdateSearchNotes, links);
};

const UpdateSearchNotes = (state, notes) => ({
  ...state,
  searchLinks: notes,
});

const GetSearchLinks = (state) => {
  return [state, [searchNotes, { state, UpdateSearchNotes }]];
};
// modules
// toggle input OR icon

// set some value for the input on input change

// add event handlers to
// onchange
// check
// confirm

const ControlModule = (state, type) => {
  const types = {
    SEARCH: {
      iconKey: "search",
      inputId: "search-input",
      placeholder: "Search...",
      onConfirm: GetSearchLinks,
    },
    ADD: {
      iconKey: "plus",
      inputId: "new-input",
      placeholder: "Add a Note",
      onConfirm: () => {
        if (state.controls.ADD.inputValue !== "") {
          window.location.href = `#${state.controls.ADD.inputValue}`;
          window.location.href = `${location.origin}/notes/${state.controls.ADD.inputValue}`;
        }
      },
    },
  };

  const inputHandler = (state, event) => ({
    ...state,
    controls: {
      ...state.controls,
      [type]: {
        inputValue: event.target.value,
      },
    },
  });

  const open = (state) => {
    const newState = {
      ...state,
      controls: {
        ...state.controls,
        active: type,
        [type]: {
          inputValue: "",
        },
      },
    };
    return [newState, [renderIcons], [focusInput, { id: types[type].inputId }]];
  };

  const close = (state) => {
    const newState = {
      ...state,
      controls: {
        ...state.controls,
        active: "",
      },
    };
    return [newState, [renderIcons]];
  };

  const isOpen = state.controls.active === type;

  if (isOpen) {
    return h("div", { class: "input-wrap" }, [
      h("input", {
        class: "input",
        id: types[type].inputId,
        placeholder: types[type].placeholder,
        oninput: inputHandler,
      }),
      h(
        "a",
        {
          class: "icon-wrap check",
          id: "check-search",
          onclick: types[type].onConfirm,
        },
        [h("i", { "data-feather": "check", class: "icon" })]
      ),
      h(
        "a",
        {
          class: "icon-wrap x-icon x",
          onclick: close,
        },
        [h("i", { "data-feather": "x", class: "icon" })]
      ),
    ]);
  }
  return h("a", { class: "icon-wrap", onclick: open }, [
    h("i", { "data-feather": types[type].iconKey, class: "icon" }),
  ]);
};

// Toggle List Module

const ToggleList = {
  init: (x) => x,
  toggle: (x) => !x,
  model: ({ getter, setter }) => {
    const Toggle = (state) =>
      setter(state, ToggleList.toggle(getter(state)[0]));

    return (state) => ({
      value: getter(state)[0],
      tag: getter(state)[1],
      links: getter(state)[2],
      Toggle,
    });
  },
  view: (model) => {
    if (model.links.length === 0) {
      return h("div", {}, []);
    }
    if (model.value) {
      return h("div", { class: "toggle-list" }, [
        h("a", { class: "toggle-title collapsed", onclick: model.Toggle }, [
          h("div", { class: "title-tag" }, text(model.tag)),
          h("div", { class: "icon-wrap mlauto" }, [
            h("i", { "data-feather": "chevron-down", class: "icon" }),
          ]),
        ]),
      ]);
    }
    return h("div", { class: "toggle-list" }, [
      h("a", { class: "toggle-title", onclick: model.Toggle }, [
        h("div", { class: "title-tag" }, text(model.tag)),
        h("a", { class: "icon-wrap mlauto toggle-chevron-active" }, [
          h("i", { "data-feather": "chevron-up", class: "icon" }),
        ]),
      ]),
      ...model.links.map((link) =>
        h("a", { href: `#${link}`, class: "toggle-link" }, text(link))
      ),
    ]);
  },
};

const recentList = ToggleList.model({
  getter: (state) => [state.collapseRecent, "Recent", state.note.recent_notes],
  setter: (state, toggleRecent) => [
    { ...state, collapseRecent: toggleRecent },
    [renderIcons],
  ],
});

const linksList = ToggleList.model({
  getter: (state) => [state.collapseLinks, "Links", state.note.links],
  setter: (state, toggleLinks) => [
    { ...state, collapseLinks: toggleLinks },
    [renderIcons],
  ],
});

const backlinksList = ToggleList.model({
  getter: (state) => [
    state.collapseBacklinks,
    "Backlinks",
    state.note.backlinks,
  ],
  setter: (state, toggleBacklinks) => [
    { ...state, collapseBacklinks: toggleBacklinks },
    [renderIcons],
  ],
});

const searchList = ToggleList.model({
  getter: (state) => [state.collapseSearch, "Search", state.searchLinks],
  setter: (state, toggleSearch) => [
    { ...state, collapseSearch: toggleSearch },
    [renderIcons],
  ],
});

// views
const LinkNumberDec = (length, backlinks = true, collapsed) => {
  if (collapsed) {
    return h(
      "div",
      { class: "link-num-dec-collapsed icons-top" },
      text(`${length}`)
    );
  }
  return h(
    "div",
    { class: "link-num-dec" },
    text(`${length} ${backlinks ? "back" : ""}link${length !== 1 ? "s" : ""}`)
  );
};

const editBtn = (props) => {
  return h("div", {}, [
    h("a", { class: "icon-wrap", onclick: View }, [
      h("i", { "data-feather": "eye", class: "icon" }),
    ]),
  ]);
};

const viewBtn = (props) => {
  return h("a", { class: "icon-wrap", onclick: Edit }, [
    h("i", { "data-feather": "edit-2", class: "icon" }),
  ]);
};

const central = (props) => {
  const svg = `<svg width="32" height="32" viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g clip-path="url(#deta_new_svg__clip0)"><path d="M111.14 0c61.38 0 111.139 49.705 111.139 111.02S172.52 222.04 111.14 222.04C49.759 222.04 0 172.335 0 111.02S49.759 0 111.14 0z" fill="#EF39A8"></path><path d="M111.404 21.676c49.689 0 89.97 40.237 89.97 89.873s-40.281 89.873-89.97 89.873-89.97-40.237-89.97-89.873 40.281-89.873 89.97-89.873z" fill="#BD399C"></path><path d="M111.404 45.465c36.536 0 66.154 29.586 66.154 66.084 0 36.497-29.618 66.083-66.154 66.083S45.25 148.046 45.25 111.549c0-36.498 29.618-66.084 66.154-66.084z" fill="#93388E"></path><path d="M110.874 65.555c24.844 0 44.985 20.119 44.985 44.937 0 24.817-20.141 44.936-44.985 44.936s-44.985-20.119-44.985-44.936c0-24.818 20.141-44.937 44.985-44.937z" fill="#6030A2"></path><path d="M339 170.836h49.915c23.004 0 40.365-5.842 51.867-17.745 11.719-11.902 17.579-25.752 17.579-41.983 0-16.23-5.86-30.296-17.579-42.199-11.502-11.902-28.863-17.745-51.867-17.745H339v119.672zm96.574-59.728c0 11.686-3.907 21.641-11.719 29.864-7.596 8.007-19.315 12.119-34.94 12.119h-27.779V68.909h27.779c15.625 0 27.344 4.112 34.94 12.119 7.812 8.223 11.719 18.178 11.719 30.08zm40.582 10.388c0 30.08 19.098 51.504 52.302 51.504 22.136 0 39.931-10.604 47.744-30.513h-24.523c-5.426 8.44-13.022 12.768-23.221 12.768-16.928 0-27.778-10.82-29.732-27.7h79.212v-6.059c0-29.648-19.966-51.505-50.782-51.505-31.034 0-51 21.208-51 51.505zm78.995-8.224h-56.208c2.388-14.932 11.936-25.535 28.213-25.535 15.843 0 25.608 10.387 27.995 25.535zm73.353 20.992V88.386h24.957v-16.23h-24.957V49h-21.702v23.155h-16.06v16.23h16.06v45.879c0 14.499 3.038 24.237 9.332 29.431 6.293 5.193 15.191 7.79 26.693 7.79 3.69 0 6.944-.216 9.766-.865l4.123-.866v-17.096l-4.123.433c-2.822.433-6.076.649-9.766.649-11.719 0-14.323-6.059-14.323-19.476zm93.101-63.624c-14.54 0-25.825 3.03-33.638 9.306-8.029 6.276-11.936 13.85-11.936 22.723h22.136c0-10.388 11.719-14.283 23.438-14.283 14.757 0 23.872 5.193 23.872 18.827v6.059h-26.693c-26.259 0-46.659 6.709-46.659 28.782 0 20.342 15.625 30.946 38.847 30.946 14.973 0 25.607-3.679 31.901-11.037l3.039-3.678c0 4.111 1.735 10.387 2.386 12.551H770v-1.731l-1.519-4.761c-.868-3.246-1.302-8.223-1.302-15.148v-38.088c0-28.998-16.493-40.468-45.574-40.468zm23.872 57.131c0 19.693-9.982 29.864-28.863 29.864-12.37 0-22.354-4.111-22.354-14.499 0-11.902 10.852-15.365 24.524-15.581l26.693.216z" fill="#000"></path></g><defs><clipPath id="deta_new_svg__clip0"><path fill="#fff" d="M0 0h770v222.04H0z"></path></clipPath></defs>
  </svg>`;

  const oneExpandedSide = props.showLeft ? !props.showRight : props.showRight;
  const bothExpandedSides = props.showLeft && props.showRight;

  let centralWidth;
  const leftPadding = props.showLeft ? "pd-l-sm" : "pd-l-md";
  const rightPadding = props.showRight ? "pd-r-sm" : "pd-r-md";

  if (oneExpandedSide) {
    centralWidth = "cp-md";
  } else if (bothExpandedSides) {
    centralWidth = "cp-sm";
  } else {
    centralWidth = "cp-lg";
  }

  return h("div", { class: `central-pane  ${centralWidth}` }, [
    h("div", { class: `central-content-wrap ${leftPadding} ${rightPadding}` }, [
      h("div", { class: "title-bar" }, [
        h("div", { class: "titlebar-title" }, text(props.note.name)),
        h("div", { class: "titlebar-right" }, [
          props.view === "EDIT" ? editBtn(props) : viewBtn(props),
        ]),
      ]),
      h("div", { class: "content-wrapper" }, [
        h("div", { id: "container", class: "main" }),
      ]),
    ]),
    h("div", { class: `footer` }, [
      h(
        "div",
        { class: `footer-content-wrap ${leftPadding} ${rightPadding}` },
        [
          h(
            "div",
            { class: "last-modified" },
            text(`${getlastEdited(props.note.last_modified)}`)
          ),
          h(
            "a",
            {
              class: "sponsor mlauto",
              href: "https://deta.space/discovery/yarc",
            },
            [
              h("div", { innerHTML: svg, class: "sponsor-svg" }),
              h("div", { class: "sponsor-message" }, text("Install on Deta")),
            ]
          ),
        ]
      ),
    ]),
  ]);
};
const left = (props) => {
  if (!props.showLeft) {
    return h("div", { class: "side-pane-collapsed left-pane" }, [
      h(
        "a",
        { class: "icon-wrap mlauto", onclick: [UncollapseAndFocus, "ADD"] },
        [h("i", { "data-feather": "plus", class: "icon" })]
      ),
      h(
        "a",
        { class: "icon-wrap mlauto", onclick: [UncollapseAndFocus, "SEARCH"] },
        [h("i", { "data-feather": "search", class: "icon" })]
      ),
      h("div", { class: "footer" }, [
        h("a", { class: "icon-wrap", onclick: ToggleLeft }, [
          h("i", { "data-feather": "chevrons-right", class: "icon" }),
        ]),
      ]),
    ]);
  }

  return h("div", { class: "side-pane left-pane" }, [
    h("div", { class: "control-wrap" }, [
      ControlModule(props, "ADD"),
      ControlModule(props, "SEARCH"),
    ]),
    // needs to be wrapped otherwise hyperapp errors
    h("div", {}, [ToggleList.view(searchList(props))]),
    // needs to be wrapped otherwise hyperapp errors
    h("div", {}, [ToggleList.view(recentList(props))]),
    h("div", { class: "footer" }, [
      h("a", { class: "icon-wrap mlauto", onclick: ToggleLeft }, [
        h("i", { "data-feather": "chevrons-left", class: "icon" }),
      ]),
    ]),
  ]);
};

const right = (props) => {
  if (!props.showRight) {
    return h("div", { class: "side-pane-collapsed right-pane-collapsed" }, [
      LinkNumberDec(props.note.links.length, false, true),
      h("div", { class: "list-border" }, [
        LinkNumberDec(props.note.backlinks.length, true, true),
      ]),

      h("div", { class: "footer" }, [
        h("a", { class: "icon-wrap", onclick: ToggleRight }, [
          h("i", { "data-feather": "chevrons-left", class: "icon" }),
        ]),
      ]),
    ]);
  }

  return h("div", { class: "side-pane right-pane" }, [
    h("div", { class: "right-content-wrap" }, [
      ToggleList.view(linksList(props)),
      h("div", { class: "list-border" }, [
        ToggleList.view(backlinksList(props)),
      ]),
    ]),
    LinkNumberDec(props.note.links.length, false, false),
    LinkNumberDec(props.note.backlinks.length, true, false),
    h("div", { class: "footer" }, [
      h("a", { class: "icon-wrap", onclick: ToggleRight }, [
        h("i", { "data-feather": "chevrons-right", class: "icon" }),
      ]),
    ]),
  ]);
};

const main = (props) => {
  return h("div", { class: "wrapper" }, [
    left(props),
    central(props),
    right(props),
  ]);
};

/*
note:
{
    name: str,
    content: str,
    links: [],
    backlinks: [],
    base_url: str,
    last_modified: str,
    recent_notes: []
}
*/

const initState = {
  view: "VIEW",
  note: {
    name: "Loading",
    content: "Loading...",
    links: [],
    backlinks: [],
    last_modified: new Date().toISOString(),
    recent_notes: [],
  },
  controls: {
    active: "",
    SEARCH: {
      inputValue: "",
    },
    ADD: {
      inputValue: "",
    },
  },
  showLeft: true,
  showRight: true,
  collapseRecent: false,
  collapseLinks: false,
  collapseBacklinks: false,
  collapseSearch: false,
  searchTerm: "",
  searchLinks: [],
  route: "",
};

app({
  init: [initState],
  view: (state) => main(state),
  subscriptions: (state) => [onhashchange(HashHandler)],
  node: document.getElementById("app"),
});
