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

// note api
const getNote = async (name) => {
  const rawResponse = await fetch(`/notes/${encodeURI(name)}?json=true`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (rawResponse.status === 200) {
    const note = await rawResponse.json();
    return note;
  }
  return null;
};

const getLocalNote = (name) => {

  const note = JSON.parse(localStorage.getItem(name));

  return note ? note : null;
};

const fetchRelatedNotes = async (links, backlinks, recentLinks) => {
  console.log("related notes...");
  const relatedLinks = Array.from(
    new Set([...links, ...backlinks, ...recentLinks])
  );
  for (const link of relatedLinks) {
    const note = await getNote(link);
    if (note) {
      localStorage.setItem(link, JSON.stringify(note));
    }
  }
  return;
};

const updateDatabase = async (dispatch, options) => {
  fetch(`/${encodeURI(options.state.route)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.state.note),
  })
    .then(async (res) => {
      if (res.status === 200) {
        console.log("saved");
        const note = await getNote(options.state.note.name);
        localStorage.setItem(options.state.note.name, JSON.stringify(note));
        dispatch(SetStatus, new Date().toUTCString());
      }
    })
    .catch((err) => {
      // case of an expired token, save it to local storage and load on boot
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
      dispatch(SetStatus, "failed to save, please refresh.");
    });
};

const modifyPublic = (dispatch, options) => {
  const response = fetch(`/public/${encodeURI(options.note.name)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_public: options.note.is_public }),
  });
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
      hash === ""
        ? new Date().toLocaleDateString("fr-CA")
        : decodeURI(hash.substring(1)),
  };
  return [
    newState,
    [
      onEnter,
      {
        state: newState,
        NoteInit,
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
      value: options.content,
      lineNumbers: false,
      lineWrapping: true,
      viewportMargin: Infinity,
      autoCloseBrackets: true,
      mode: "markdown",
    });

    jar.on("change", function (cm, change) {
      dispatch(UpdateContent, cm.getValue());
      if (!(jar.getTokenTypeAt(jar.getCursor()) === "link")) {
        clearTimeout(timeout);
        timeout = setTimeout(function () {
          dispatch(DebounceSave);
        }, 1500);
      }
    });
  });
};

const attachMarkdown = (dispatch, options) => {
  const { rawMD, uniqueLinks } = options;

  const convertedMarkdown = linkSub(rawMD, uniqueLinks);
  const html = converter.makeHtml(convertedMarkdown);
  requestAnimationFrame(() => {
    const container = document.getElementById("container");
    container.innerHTML = html;
  });
};

const onEnter = (dispatch, options) => {
  const note = getLocalNote(options.state.route);

  if (note) {
    const content = note.content;
    const uniqueLinks = getUniqueLinks(content);
    const convertedMarkdown = linkSub(content, uniqueLinks);
    const html = converter.makeHtml(convertedMarkdown);
    requestAnimationFrame(() => {
      const container = document.getElementById("container");
      container.innerHTML = html;
    });
  }
  dispatch(NoteInit, note ? note : null);
};

const LazyLoad = async (dispatch, options) => {
  const name = options.state.route;
  let note = options.state.note;

  let rawResponse = await getNote(name);

  if (rawResponse) {
    note = rawResponse;
    if (
      new Date(note.last_modified) >
        new Date(options.state.note.last_modified) ||
      options.emptyNote
    ) {
      console.log("Lazy load init");
      dispatch(LazyUpdate, note);
    }
  }
};

const DebounceSave = (state) => {
  const bareLinks = getBareLinks(state.note.content);
  const newState = {
    ...state,
    note: {
      ...state.note,
      last_modified: "saving",
      links: bareLinks,
      recent_notes: [
        state.note.name,
        ...state.note.recent_notes.filter((name) => name != state.note.name),
      ],
    },
  };
  return [newState, [updateDatabase, { state: newState }], [renderIcons]];
};

// actions
const LazyUpdate = (state, note) => {
  const links = note.links;
  const backlinks = note.backlinks;
  const recentLinks = note.recent_notes;
  const newState = {
    ...state,
  };
  newState.note = note;
  const content = note.content;
  const uniqueLinks = getUniqueLinks(content);

  fetchRelatedNotes(links, backlinks, recentLinks);
  localStorage.setItem(note.name, JSON.stringify(note));
  return [
    newState,
    [attachMarkdown, { rawMD: content, uniqueLinks }],
    [updateDatabase, { state: newState }][renderIcons],
  ];
};

const NoteInit = (state, note) => {
  const newState = {
    ...state,
    note: note ? note : state.note,
  };

  return [
    newState,
    [LazyLoad, { state: newState, emptyNote: note ? false : true, LazyUpdate }],
    [renderIcons],
  ];
};

const UpdateContent = (state, newContent) => {
  const bareLinks = getBareLinks(newContent);
  return [
    {
      ...state,
      note: {
        ...state.note,
        content: newContent,
        last_modified: "saving",
        links: bareLinks,
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

  return [newState, [updateDatabase, { state: newState }], [renderIcons]];
};

const SetStatus = (state, status) => {
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

const Edit = (state) => {
  const newState = {
    ...state,
    view: "EDIT",
  };
  return [
    newState,
    [attachCodeJar, { content: state.note.content }],
    [renderIcons],
  ];
};

const View = (state) => {
  const rawMD = state.note.content;
  const bareLinks = getBareLinks(state.note.content);
  const uniqueLinks = getUniqueLinks(rawMD);
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
        ...state.note.recent_notes.filter((name) => name != state.note.name),
      ],
    },
  };
  return [
    newState,
    [attachMarkdown, { rawMD, uniqueLinks }],
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

// Logic related to the control panel, search and add

const searchNotes = async (dispatch, options) => {
  const searchTerm = options.state.controls.SEARCH.inputValue;
  let links = [];

  const rawResponse = await fetch(`/search/${searchTerm}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (rawResponse.status === 200) {
    links = await rawResponse.json();
  }

  dispatch(UpdateSearchNotes, links);
};

const UpdateSearchNotes = (state, notes) => ({
  ...state,
  searchLinks: notes,
});

const GetSearchLinks = (state) => {
  return [state, [searchNotes, { state, UpdateSearchNotes }]];
};

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
          window.location.replace(`${window.location.origin}/notes#${state.controls.ADD.inputValue}`);
          window.location.reload();
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
      setter(state, ToggleList.toggle(getter(state).value));

    return (state) => ({
      value: getter(state).value,
      tag: getter(state).tag,
      links: getter(state).links,
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
        h(
          "a",
          { href: `#${link}`, class: "toggle-link" },
          text(link.length > 25 ? link.substring(0, 25) + "..." : link)
        )
      ),
    ]);
  },
};

const recentList = ToggleList.model({
  getter: (state) => ({
    value: state.collapseRecent,
    tag: "Recent",
    links: state.note.recent_notes,
  }),
  setter: (state, toggleRecent) => [
    { ...state, collapseRecent: toggleRecent },
    [renderIcons],
  ],
});

const linksList = ToggleList.model({
  getter: (state) => ({
    value: state.collapseLinks,
    tag: "Links",
    links: state.note.links,
  }),
  setter: (state, toggleLinks) => [
    { ...state, collapseLinks: toggleLinks },
    [renderIcons],
  ],
});

const backlinksList = ToggleList.model({
  getter: (state) => ({
    value: state.collapseBacklinks,
    tag: "Backlinks",
    links: state.note.backlinks,
  }),
  setter: (state, toggleBacklinks) => [
    { ...state, collapseBacklinks: toggleBacklinks },
    [renderIcons],
  ],
});

const searchList = ToggleList.model({
  getter: (state) => ({
    value: state.collapseSearch,
    tag: "Search",
    links: state.searchLinks,
  }),
  setter: (state, toggleSearch) => [
    { ...state, collapseSearch: toggleSearch },
    [renderIcons],
  ],
});

// views

const LinkNumberDec = (length, backlinks = true, collapsed) => {
  if (collapsed) {
    return h("div", { class: "link-num-dec-collapsed" }, text(`${length}`));
  }
  return h(
    "div",
    { class: "link-num-dec" },
    text(`${length} ${backlinks ? "back" : ""}link${length !== 1 ? "s" : ""}`)
  );
};

// // left section
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
    h("div", {class:"lc"}, [

      // needs to be wrapped otherwise hyperapp errors
      h("div", {}, [ToggleList.view(searchList(props))]),
      // needs to be wrapped otherwise hyperapp errors
      h("div", {}, [ToggleList.view(recentList(props))]),

    ]),
    h("div", { class: "footer" }, [
      h("a", { class: "icon-wrap mlauto", onclick: ToggleLeft }, [
        h("i", { "data-feather": "chevrons-left", class: "icon" }),
      ]),
    ]),
  ]);
};

const right = (props) => {
  if (!props.showRight) {
    return h("div", { class: "side-pane-collapsed right-pane" }, [
      LinkNumberDec(props.note.links.length, false, true),
      LinkNumberDec(props.note.backlinks.length, true, true),
      h("div", { class: "footer" }, [
        h("a", { class: "icon-wrap", onclick: ToggleRight }, [
          h("i", { "data-feather": "chevrons-left", class: "icon" }),
        ]),
      ]),
    ]);
  }

  return h("div", { class: "side-pane right-pane" }, [
    h("div", {class: "rc"}, [
      h("div", { class: "right-content-wrap" }, [
        h("div", {}, [ToggleList.view(linksList(props))]),
        h("div", {}, [ToggleList.view(backlinksList(props))]),
      ]),

    ]),
    h("div", {class:"link-desc"}, [
      LinkNumberDec(props.note.links.length, false, false),
      LinkNumberDec(props.note.backlinks.length, true, false),
    ]),
    h("div", { class: "footer" }, [
      h ("div", {}, [
        h("a", { class: "icon-wrap", onclick: ToggleRight }, [
          h("i", { "data-feather": "chevrons-right", class: "icon" }),
        ]),
      ]),

    ]),
  ]);
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

const lockBtn = (props) => {
  return h("a", { class: "icon-wrap", onclick: Share }, [
    h("i", { "data-feather": "lock", class: "icon" }),
  ]);
};

const unlockBtn = (props) => {
  return h("div", {}, [
    h("a", { class: "icon-wrap", onclick: Share }, [
      h("i", { "data-feather": "unlock", class: "icon" }),
    ]),
  ]);
};

const central = (props) => {
  const publicUrl = `${location.origin}/public/${props.note.name}`;

  const publicContent =
    props.note.is_public === true
      ? h("div", { class: "url-content mlauto" }, [
          h("div", { class: "url-tag" }, text(`public url:${" "}`)),
          h(
            "a",
            { class: "url-wrapper ", href: publicUrl },
            text(
              props.note.name.length > 25
                ? `${location.origin}/public/${props.note.name.substring(
                    0,
                    4
                  )}...`
                : publicUrl
            )
          ),
        ])
      : h("div", { class: "url-content mlauto" }, [
          h("div", { class: "url-tag " }, text("")),
        ]);

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
          props.note.is_public ? unlockBtn(props) : lockBtn(props),
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
          publicContent,
        ]
      ),
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
    base_url: `https://${window.location.host}/`,
    recent_index: new Date().getTime(),
    is_public: false,
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
  searchLinks: [],
  showLeft: true,
  showRight: true,
  collapseRecent: false,
  collapseLinks: false,
  collapseBacklinks: false,
  collapseSearch: false,
};

app({
  init: [
    initState,
    // [
    //   attachMarkdown,
    //   {
    //     rawMD: initState.note.content,
    //     uniqueLinks: getUniqueLinks(initState.note.content),
    //   },
    // ],
    [renderIcons],
  ],
  view: (state) => main(state),
  subscriptions: (state) => [onhashchange(HashHandler)],
  node: document.getElementById("app"),
});
