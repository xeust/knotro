// /** input in html file by Jinja template
//  *
// import { h, app } from "https://unpkg.com/hyperapp";
// let input = {{ note_data|tojson }};

// */

const converter = new showdown.Converter();
let jar;

// helpers
const linkSub = (rawMD, links) => {
  let newMD = rawMD;
  for (const each of links) {
    let replacement;
    if (each[2] !== "~") {
      const bareName = each.substring(2, each.length - 2);
      replacement = `[${bareName}](/notes/${encodeURI(bareName)})`;
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

const checkUnsaved = (options) => {
  const note = options.note;
  const name = note.name;
  const localNote = JSON.parse(localStorage.getItem(name));
  if (
    localNote &&
    new Date(localNote.last_modified) > new Date(note.last_modified)
  ) {
    return {
      content: localNote.content,
      uniqueLinks: getUniqueLinks(localNote.content),
    };
  }
  return { content: note.content, uniqueLinks: getUniqueLinks(note.content) };
};

// // effects
const renderIcons = (dispatch, options) => {
  requestAnimationFrame(() => {
    feather.replace();
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
      dispatch(options.UpdateContent(options.state, cm.getValue()));

      clearTimeout(timeout);

      timeout = setTimeout(function () {
        dispatch(options.DebounceSave(dispatch, options.state, cm.getValue()));
      }, 1000);
    });
  });
};

const updateDatabase = (dispatch, options) => {
  fetch(`/${options.state.note.name}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.state.note),
  })
    .then((res) => {
      if (res.status === 200) {
        console.log("saved");
        dispatch(setStatus(options.state, new Date().toUTCString()));
      }
    })
    .catch((err) => {
      console.log("error");
      const newState = {
        ...options.state,
        note: {
          ...options.state.note,
          last_modified: new Date().toUTCString(),
        },
      };
      localStorage.setItem(
        options.state.note.name,
        JSON.stringify(newState.note)
      );
      dispatch(setStatus(options.state, "failed to save"));
    });
};

const modifyPublic = (dispatch, options) => {
  const response = fetch(`/public/${options.note.name}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_public: options.note.is_public }),
  });
};

const attachMarkdown = (dispatch, options) => {
  const { content, uniqueLinks } = checkUnsaved({ note: options.state.note });

  const convertedMarkdown = linkSub(content, uniqueLinks);
  const html = converter.makeHtml(convertedMarkdown);
  requestAnimationFrame(() => {
    const container = document.getElementById("container");
    container.innerHTML = html;
  });
  dispatch(UpdateUnsaved(options.state, content));
};

const DebounceSave = (dispatch, state, newContent) => {
  const newState = {
    ...state,
    note: {
      ...state.note,
      content: newContent,
      last_modified: "saving",
      recent_notes: [
        state.note.name,
        ...state.note.recent_notes.filter((name) => name != state.note.name),
      ],
    },
  };
  return [newState, [updateDatabase, { state: newState }], [renderIcons]];
};

const getNotes = async (dispatch, options) => {
  const searchTerm = options.state.searchTerm;
  const rawResponse = await fetch(`/search/${searchTerm}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  let links = await rawResponse.json();
  dispatch(options.addSearchNotes(options.state, links));
};

// actions
const UpdateContent = (state, newContent) => {
  return [
    {
      ...state,
      note: {
        ...state.note,
        content: newContent,
        last_modified: "saving",
        recent_notes: [
          state.note.name,
          ...state.note.recent_notes.filter((name) => name != state.note.name),
        ],
      },
    },
    [renderIcons],
  ];
};

const UpdateUnsaved = (state, newContent) => {
  const newState = {
    ...state,
    note: {
      ...state.note,
      content: newContent,
      last_modified: "saving",
      recent_notes: [
        state.note.name,
        ...state.note.recent_notes.filter((name) => name != state.note.name),
      ],
    },
  };

  return [
    newState,
    [updateDatabase, { state: newState }],
    [renderIcons],
  ];
};
const setStatus = (state, status) => {
  return [
    {
      ...state,
      note: {
        ...state.note,
        last_modified: status,
        recent_notes: [
          state.note.name,
          ...state.note.recent_notes.filter((name) => name != state.note.name),
        ],
      },
    },
    [renderIcons],
  ];
};

// // actions

const addSearchNotes = (state, notes) => ({
  ...state,
  searchLinks: notes,
});

const Edit = (state) => {
  const newState = {
    ...state,
    view: "EDIT",
  };
  return [
    newState,
    [attachCodeJar, { state: newState, UpdateContent, DebounceSave }],
    [renderIcons],
  ];
};

const View = (state) => {
  let markdown = state.note.content;
  const uniqueLinks = getUniqueLinks(markdown);
  const bareLinks = uniqueLinks
    .map((each) => each.substring(2, each.length - 2))
    .filter((mappedEach) => mappedEach[0] !== "~");

  const newState = {
    ...state,
    view: "VIEW",
    note: {
      ...state.note,
      last_modified: new Date().toUTCString(),
      content: markdown,
      links: bareLinks,
      recent_notes: [
        state.note.name,
        ...state.note.recent_notes.filter((name) => name != state.note.name),
      ],
    },
  };
  return [
    newState,
    [attachMarkdown, { state, uniqueLinks }],
    [updateDatabase, { state: newState }],
    [renderIcons],
  ];
};

const Share = (state) => {
  const newState = {
    ...state,
    view: "VIEW",
    note: {
      ...state.note,
      is_public: !state.note.is_public,
    },
  };

  return [newState, [modifyPublic, { note: newState.note }], [renderIcons]];
};
const collapseRight = (state) => {
  const newState = {
    ...state,
    collapseRight: !state.collapseRight,
    note: {
      ...state.note,
    },
  };

  return [newState, [renderIcons]];
};

const collapseLeft = (state) => {
  const newState = {
    ...state,
    collapseLeft: !state.collapseLeft,
    note: {
      ...state.note,
    },
  };

  return [newState, [renderIcons]];
};

const openSearchCollapse = (state) => {
  const newState = {
    ...state,
    inputSearch: !state.inputSearch,
    collapseLeft: !state.collapseLeft,
    note: {
      ...state.note
    }
  }
  return [newState, [renderIcons]];
}

const openAddCollapse = (state) => {
  const newState = {
    ...state,
    inputAdd: !state.inputAdd,
    collapseLeft: !state.collapseLeft,
    note: {
      ...state.note
    }
  }
  return [newState, [renderIcons]];
}

// modules
const list = {
  init: (x) => x,
  toggle: (x) => !x,
  model: ({ getter, setter }) => {
    const Toggle = (state) => setter(state, list.toggle(getter(state)[0]));

    return (state) => ({
      value: getter(state)[0],
      tag: getter(state)[1],
      links: getter(state)[2],
      Toggle,
    });
  },
  view: (model) => {
    if (model.value || model.links.length === 0) {
      return h("div", { class: "toggle-list" }, [
        h("div", { class: "toggle-title collapsed" }, [
          h(
            "div",
            { class: "title-tag", onclick: model.Toggle },
            text(model.tag)
          ),
          h(
            "div",
            { class: "icon-wrap mlauto toggle-chevron", onclick: model.Toggle },
            [h("i", { "data-feather": "chevron-down", class: "icon" })]
          ),
        ]),
      ]);
    }
    return h("div", { class: "toggle-list" }, [
      h("div", { class: "toggle-title" }, [
        h("div", { class: "title-tag" }, text(model.tag)),
        h(
          "a",
          { class: "icon-wrap mlauto toggle-chevron", onclick: model.Toggle },
          [h("i", { "data-feather": "chevron-up", class: "icon" })]
        ),
      ]),
      ...model.links.map((link) =>
        h("a", { href: `/notes/${link}`, class: "toggle-link" }, text(link))
      ),
    ]);
  },
};

const searchModule = {
  init: (x) => x,
  toggle: (x) => !x,
  model: ({ getter, setter, setSearch, setSearchLinks }) => {
    const Toggle = (state) => setter(state, searchModule.toggle(getter(state)));

    const SearchHandler = (state, event) =>
      setSearch(state, event.target.value);

    const SearchLinks = (state) => setSearchLinks(state);

    return (state) => ({
      value: getter(state),
      Toggle,
      _state: state,
      SearchHandler,
      SearchLinks,
    });
  },
  view: (model) => {
    if (model.value) {
      return h("div", {}, [
        h("div", { class: "input-wrap" }, [
          h("input", {
            class: "input",
            placeholder: "Search",
            oninput: model.SearchHandler,
          }),
          h("a", { class: "icon-wrap mlauto ", onclick: model.SearchLinks }, [
            h("i", { "data-feather": "check", class: "icon" }),
          ]),
          h("a", { class: "icon-wrap mlauto ", onclick: model.Toggle }, [
            h("i", { "data-feather": "x", class: "icon" }),
          ]),
        ]),
        list.view(searchList(model._state)),
      ]);
    }
    return h(
      "a",
      { class: "icon-wrap icons-top search_icon", onclick: model.Toggle },
      [h("i", { "data-feather": "search", class: "icon" })]
    );
  },
};

const addModule = {
  init: (x) => x,
  toggle: (x) => !x,
  model: ({ getter, setter, setNewNoteName }) => {
    const Toggle = (state) => setter(state, addModule.toggle(getter(state)));

    const AddHandler = (state, event) =>
      setNewNoteName(state, event.target.value);

    const redirectToPage = (state) => {
      window.location.href = `${location.origin}/notes/${state.newNoteName}`;
    };

    return (state) => ({
      value: getter(state),
      Toggle,
      _state: state,
      AddHandler,
      redirectToPage,
    });
  },
  view: (model) => {
    if (model.value) {
      return h("div", {}, [
        h("div", { class: "input-wrap" }, [
          h("input", {
            class: "input",
            placeholder: "Note name...",
            oninput: model.AddHandler,
          }),
          h(
            "a",
            { class: "icon-wrap mlauto ", onclick: model.redirectToPage },
            [h("i", { "data-feather": "check", class: "icon" })]
          ),
          h("a", { class: "icon-wrap mlauto ", onclick: model.Toggle }, [
            h("i", { "data-feather": "x", class: "icon" }),
          ]),
        ]),
      ]);
    }
    return h("a", { class: "icon-wrap icons-top", onclick: model.Toggle }, [
      h("i", { "data-feather": "plus", class: "icon" }),
    ]);
  },
};

// views

const ToggleList = (title, links) => {
  return h("div", { class: "toggle-list" }, [
    h("div", { class: "toggle-title" }, [
      h("div", { class: "title-tag" }, title),
      h("a", { class: "icon-wrap mlauto toggle-chevron" }, [
        h("i", { "data-feather": "chevron-down", class: "icon" }),
      ]),
    ]),
    links.map((link) =>
      h("a", { href: `/notes/${link}`, class: "toggle-link" }, link)
    ),
  ]);
};

const LinkNumberDec = (length, backlinks = true, collapsed) => {
  if (collapsed) {
    return h("div", { class: "link-num-dec-collapsed icons-top" }, text(`${length}`));
  }
  return h(
    "div",
    { class: "link-num-dec" },
    text(`${length} ${backlinks ? "back" : ""}link${length !== 1 ? "s" : ""}`)
  );
};
const recentList = list.model({
  getter: (state) => [state.collapseRecent, "Recent", state.note.recent_notes],
  setter: (state, toggleRecent) => [
    { ...state, collapseRecent: toggleRecent },
    [renderIcons],
  ],
});

const linksList = list.model({
  getter: (state) => [state.collapseLinks, "Links", state.note.links],
  setter: (state, toggleLinks) => [
    { ...state, collapseLinks: toggleLinks },
    [renderIcons],
  ],
});

const backlinksList = list.model({
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

const searchList = list.model({
  getter: (state) => [state.collapseSearch, "Search", state.searchLinks],
  setter: (state, toggleSearch) => [
    { ...state, collapseSearch: toggleSearch },
    [renderIcons],
  ],
});

const searchInput = searchModule.model({
  getter: (state) => state.inputSearch,
  setter: (state, newSearchTerm) => [
    { ...state, inputSearch: newSearchTerm },
    [renderIcons],
  ],
  setSearch: (state, newSearchTerm) => [
    { ...state, searchTerm: newSearchTerm },
    [renderIcons],
  ],
  setSearchLinks: (state) => [state, [getNotes, { state, addSearchNotes }]],
});

const addInput = addModule.model({
  getter: (state) => state.inputAdd,
  setter: (state, newName) => [{ ...state, inputAdd: newName }, [renderIcons]],
  setNewNoteName: (state, newValue) => [
    { ...state, newNoteName: newValue },
    [renderIcons],
  ],
});

const left = (props) => {
  if (props.collapseLeft) {
    return h("div", { class: "side-pane-collapsed left-pane-collapsed" }, [
      h("a", { class: "icon-wrap mlauto icons-top", onclick: openAddCollapse }, [
        h("i", { "data-feather": "plus", class: "icon" }),
      ]),
      h("a", { class: "icon-wrap mlauto icons-top", onclick: openSearchCollapse }, [
        h("i", { "data-feather": "search", class: "icon" }),
      ]),
      h("div", { class: "footer" }, [
        h("a", { class: "icon-wrap", onclick: collapseLeft }, [
          h("i", { "data-feather": "chevrons-right", class: "icon" }),
        ]),
      ]),
    ]);
  }

  return h("div", { class: "side-pane left-pane" }, [
    addModule.view(addInput(props)),

    searchModule.view(searchInput(props)),

    h("div", { class: "list-border" }, [list.view(recentList(props))]),
    h("div", { class: "footer" }, [
      h("a", { class: "icon-wrap mlauto", onclick: collapseLeft }, [
        h("i", { "data-feather": "chevrons-left", class: "icon" }),
      ]),
    ]),
  ]);
};

const right = (props) => {
  if (props.collapseRight) {
    return h("div", { class: "side-pane-collapsed right-pane-collapsed" }, [
      LinkNumberDec(props.note.links.length, false, true),
      h (
        "div", {class: "list-border"}, [
          LinkNumberDec(props.note.backlinks.length, true, true),
        ]
      ),

      h("div", { class: "footer" }, [
        h("a", { class: "icon-wrap", onclick: collapseRight }, [
          h("i", { "data-feather": "chevrons-left", class: "icon" }),
        ]),
      ]),
    ]);
  }

  return h("div", { class: "side-pane right-pane" }, [
    h("div", { class: "right-content-wrap" }, [
      list.view(linksList(props)),
      h("div", { class: "list-border" }, [list.view(backlinksList(props))]),
    ]),
    LinkNumberDec(props.note.links.length, false, false),
    LinkNumberDec(props.note.backlinks.length, true, false),
    h("div", { class: "footer" }, [
      h("a", { class: "icon-wrap", onclick: collapseRight }, [
        h("i", { "data-feather": "chevrons-right", class: "icon" }),
      ]),
    ]),
  ]);
};

const editBtn = (props) => {
  return h(
    "button",
    { onclick: View, class: "config-button" },
    h("div", {}, [
      h("a", { class: "icon-wrap" }, [
        h("i", { "data-feather": "eye", class: "icon" }),
      ]),
    ])
  );
};
const viewBtn = (props) => {
  return h(
    "button",
    { onclick: Edit, class: "config-button" },
    h("a", { class: "icon-wrap" }, [
      h("i", { "data-feather": "edit-2", class: "icon" }),
    ])
  );
};

const lockBtn = (props) => {
  return h(
    "button",
    { onclick: Share, class: "config-button" },
    h("a", { class: "icon-wrap" }, [
      h("i", { "data-feather": "lock", class: "icon" }),
    ])
  );
};

const unlockBtn = (props) => {
  return h(
    "button",
    { onclick: Share, class: "config-button" },
    h("div", {}, [
      h("a", { class: "icon-wrap" }, [
        h("i", { "data-feather": "unlock", class: "icon" }),
      ]),
    ])
  );
};
const central = (props) => {
  const publicUrl = `${location.origin}/public/${props.note.name}`;

  const viewButton = props.view === "EDIT" ? editBtn(props) : viewBtn(props);

  const publicContent =
    props.note.is_public === true
      ? h("div", { class: "url-content mlauto" }, [
          h("div", { class: "url-tag " }, text("public url: ")),
          h("a", { class: "url-wrapper ", href: publicUrl }, text(publicUrl)),
        ])
      : h("div", { class: "url-content mlauto" }, [
          h("div", { class: "url-tag " }, text("")),
        ]);

  const shareButton =
    props.note.is_public === true
      ? lockBtn(props)
      : unlockBtn(props);

  return h("div", { class: "central-pane" }, [
    h("div", { class: "central-content-wrap" }, [
      h("div", { class: "title-bar" }, [
        h("div", { class: "titlebar-title" }, text(props.note.name)),
        h("div", { class: "titlebar-right" }, [viewButton, shareButton]),
      ]),
      h("div", { class: "content-wrapper" }, [
        h("div", { id: "container", class: "main" }),
      ]),
    ]),
    h("div", { class: "footer" }, [
      h(
        "div",
        { class: "last-modified" },
        text(`${getlastEdited(props.note.last_modified)}`)
      ),
      publicContent,
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
  note: input,
  collapseLeft: false,
  collapseRight: false,
  collapseRecent: false,
  collapseLinks: false,
  collapseBacklinks: false,
  collapseSearch: false,
  inputSearch: false,
  inputAdd: false,
  searchTerm: "",
  searchLinks: [],
  newNoteName: "",
  todos: [],
  value: "",
};

app({
  init: [
    initState,
    [
      attachMarkdown,
      {
        state: initState,
        uniqueLinks: getUniqueLinks(input.content),
      },
    ],
    [renderIcons],
  ],
  view: (state) => main(state),
  node: document.getElementById("app"),
});



