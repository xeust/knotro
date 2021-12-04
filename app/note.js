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
      return `edited: ${minutes} minutes ago`;
    } else {
      return `edited: ${hours} hours ago`;
    }
  } else {
    return `edited: ${days} days ago`;
  }
};

// EFFECTS

// checks if localStorage has a note that didn't save to the server
// should happen when a note is opened
const checkUnsaved = (options) => {
  const { note } = options;
  const { name } = note;
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

const fetchRelatedNotes = async (dispatch, options) => {
  const  { links, backlinks, recentLinks } = options;
  console.log("caching related notes...");
  const relatedLinks = Array.from(
    new Set([...links, ...backlinks, ...recentLinks])
  );
  for (const link of relatedLinks) {
    // only fetch if no version in localStorage
    if (!getLocalNote(link)) {
      getNote(link).then(note => {
        if (note) {
          localStorage.setItem(link, JSON.stringify(note));
        }
      });
    }
  }
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
    var contentDiv = document.querySelector(".content-wrapper");
    const scrollTop = contentDiv.scrollTop;
    container.innerHTML = "";
    jar = CodeMirror(container, {
      value: options.content,
      lineNumbers: false,
      lineWrapping: true,
      viewportMargin: Infinity,
      autoCloseBrackets: true,
      autofocus: true,
      mode: "markdown",
    });
    if (options.cursorPos) {
      jar.setSelection(options.cursorPos, options.cursorPos, { scroll: true });
    }
    contentDiv.scrollTop = scrollTop;
    jar.on("change", function (cm, change) {
      dispatch(UpdateContent, {
        newContent: cm.getValue(),
        cursorPos: jar.getCursor(),
      });
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

const getLocalNote = (name) => {
  const note = JSON.parse(localStorage.getItem(name));
  return note ? note : null;
};

const lazyLoadNote = (dispatch, options) => {
  // check if there is a local version of the note
  const note = getLocalNote(options.state.route);
  console.log(note);
  if (note) {
    const content = note.content;
    const uniqueLinks = getUniqueLinks(content);
    attachMarkdown(dispatch, {rawMD: content, uniqueLinks});
  }
  // update state with local note, then
  dispatch(UpdateAndRevalidate, note ? note : null);
};

const getNoteFromServer = async (dispatch, options) => {
  const name = options.state.route;
  let note = options.state.note;
  let rawResponse = await getNote(name);
  if (rawResponse) {
    note = rawResponse;
    if (
      !options.useCaching ||
      options.nothingCached ||
      new Date(note.last_modified) >
      new Date(options.state.note.last_modified) 
    ) {
      console.log("Lazy load init");
      dispatch(UpdateNote, note);
    }
  }

  if (options.useCaching) {
    // caching logic
    localStorage.setItem(note.name, JSON.stringify(note));
    const { links, backlinks } = note;
    const recentLinks = note.recent_notes;
    fetchRelatedNotes(dispatch, {links, backlinks, recentLinks});
  }
};

// actions
const UpdateNote = (state, note) => {
  const newState = {
    ...state,
    note
  };
  const content = note.content;
  const uniqueLinks = getUniqueLinks(content);
  return [
    newState,
    [attachMarkdown, { rawMD: content, uniqueLinks }],
    [renderIcons]
  ];
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

const UpdateAndRevalidate = (state, note) => {
  const newState = {
    ...state,
    note: note ? note : state.note,
  };

  return [
    newState,
    [getNoteFromServer, { state: newState, nothingCached: note ? false : true, useCaching: true}],
    [renderIcons],
  ];
};

const UpdateContent = (state, { newContent, cursorPos }) => {
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
      cursorPos,
    },
    [renderIcons],
  ];
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

const Edit = (state) => {
  const newState = {
    ...state,
    view: "EDIT",
  };

  return [
    newState,
    [
      attachCodeJar,
      { content: state.note.content, cursorPos: state.cursorPos },
    ],
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


// VIEWS

// 0. Re-usable Modules

// toggle input OR icon

// set some value for the input on input change

// add event handlers to
// onchange
// check
// confirm

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

const UpdateSearchNotes = (state, notes) => [{
  ...state,
  searchLinks: notes,
}, [renderIcons]];

const GetSearchLinks = (state) => {
  return [state, [searchNotes, { state, UpdateSearchNotes }], [renderIcons]];
};

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
          window.location.replace(
            `${window.location.origin}/notes#${state.controls.ADD.inputValue}`
          );
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
      hasTopBorder: getter(state).hasTopBorder,
      Toggle,
    });
  },
  view: (model) => {
    const topBorder = model.hasTopBorder ? "toggle-list-top" : "";
    if (model.links.length === 0) {
      return h("div", {}, []);
    }
    if (model.value) {
      return h("div", { class: `toggle-list ${topBorder}` }, [
        h("a", { class: "toggle-title collapsed", onclick: model.Toggle }, [
          h("div", { class: "title-tag" }, text(model.tag)),
          h("div", { class: "icon-wrap mlauto" }, [
            h("i", { "data-feather": "chevron-down", class: "icon" }),
          ]),
        ]),
      ]);
    }
    return h("div", { class: `toggle-list ${topBorder}` }, [
      h("a", { class: "toggle-title", onclick: model.Toggle }, [
        h("div", { class: "title-tag" }, text(model.tag)),
        h("a", { class: "icon-wrap mlauto toggle-chevron-active" }, [
          h("i", { "data-feather": "chevron-up", class: "icon" }),
        ]),
      ]),
      ...model.links.map((link) =>
        h("a", { href: `#${link}`, class: "toggle-link ellipsis" }, text(link))
      ),
    ]);
  },
};

// List views
// do the border lines here.
const recentList = ToggleList.model({
  getter: (state) => ({
    value: state.collapseRecent,
    tag: "Recent",
    links: state.note.recent_notes,
    hasTopBorder: state.searchLinks.length > 0 ? true : false
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
    hasTopBorder: false
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
    hasTopBorder: state.note.links.length > 0 ? true : false
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
    hasTopBorder: false
  }),
  setter: (state, toggleSearch) => [
    { ...state, collapseSearch: toggleSearch },
    [renderIcons],
  ],
});

// 1. Central Section

const editBtn = (props) => {
  return h("div", {}, [
    h("a", { class: "icon-wrap", onclick: View, alt: "View Note", title: "View Note" }, [
      h("i", { "data-feather": "eye", class: "icon" }),
    ]),
  ]);
};

const viewBtn = (props) => {
  return h("a", { class: "icon-wrap", onclick: Edit, alt: "Edit Note", title: "Edit Note" }, [
    h("i", { "data-feather": "edit-2", class: "icon" }),
  ]);
};

const lockBtn = (props) => {
  return h("a", { class: "icon-wrap", onclick: Share, alt: "Make Note Public", title: "Make Note Public" }, [
    h("i", { "data-feather": "share", class: "icon" }),
  ]);
};

const unlockBtn = (props) => {
  return h("div", {}, [
    h("a", { class: "icon-wrap", onclick: Share, alt: "Make Note Private", title: "Make Note Private", style: {color: "#98b9f9"} }, [
      h("i", { "data-feather": "share", class: "icon" }),
    ]),
  ]);
};

const central = (props) => {
  const oneExpandedSide = props.showLeft ? !props.showRight : props.showRight;
  const bothExpandedSides = props.showLeft && props.showRight;

  let centralWidth;
  let contentWidth;

  if (oneExpandedSide) {
    centralWidth = window.innerWidth - 280;
  } else if (bothExpandedSides) {
    centralWidth = window.innerWidth - 480;
  } else {
    centralWidth = window.innerWidth - 80;
  }

  contentWidth = centralWidth > 1182 ? 882 : centralWidth - 300;

  // shrink the content-wrap divs based on central width
  // 886, 768, 480, 288

  return h("div", { class: `central-pane`, style: { "width": `${centralWidth}px` } }, [
    h("div", { class: `central-content-wrap`, style: { "width": `${contentWidth}px` } }, [
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
    h("div", { class: `footer`, style: { "width": `${centralWidth}px` } }, [
      h(
        "div",
        { class: `footer-content-wrap`, style: { "width": `${contentWidth}px` } },
        [  
          h(
            "div",
            { class: "last-modified truncated" },
            text(`${getlastEdited(props.note.last_modified)}`)
          ),
          publicContent(props),
        ]
      ),
    ]),
  ]);
};

// 2. Left Section

// left section
const left = (props) => {
  if (!props.showLeft) {
    return leftClose(props);
  } else {
    return leftOpen(props);
  }
};


// left close !showLeft
const leftClose = (props) => {
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
      h("div", {}, [
        h("a", { class: "icon-wrap", onclick: ToggleLeft }, [
          h("i", { "data-feather": "chevrons-right", class: "icon" }),
        ]),
      ]),
    ]),
  ]);
}

// left open showLeft
const leftOpen = (props) => {
  return h("div", { class: "side-pane left-pane" }, [
    h("div", { class: "control-wrap" }, [
      ControlModule(props, "ADD"),
      ControlModule(props, "SEARCH"),
    ]),
    h("div", { class: "lc" }, [
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
}

// 3. Right Section

const right = (props) => {
  if (!props.showRight) {
    return rightClose(props);
  }
  return rightOpen(props);
};


// rightClose 
const rightClose = (props) => {
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

// rightOpen 
const rightOpen = (props) => {
  return h("div", { class: "side-pane right-pane" }, [
    h("div", { class: "rc" }, [
      h("div", { class: "right-content-wrap" }, [
        h("div", {}, [ToggleList.view(linksList(props))]),
        h("div", {}, [ToggleList.view(backlinksList(props))]),
      ]),
    ]),
    h("div", { class: "link-desc" }, [
      LinkNumberDec(props.note.links.length, false, false),
      LinkNumberDec(props.note.backlinks.length, true, false),
    ]),
    h("div", { class: "footer" }, [
      h("div", {}, [
        h("a", { class: "icon-wrap", onclick: ToggleRight }, [
          h("i", { "data-feather": "chevrons-right", class: "icon" }),
        ]),
      ]),
    ]),
  ]);
}

// 4. Mobile Views

const mobileNav = (props) => {
  if (!props.showLeft) {
    return h("div", {class: "empty"});
  }
  return h("div", { class: "side-pane left-pane side-pane-mb" }, [
    h("div", { class: "control-wrap" }, [
      ControlModule(props, "ADD"),
      ControlModule(props, "SEARCH"),
    ]),
    h("div", { class: "lc" }, [
      // needs to be wrapped otherwise hyperapp errors
      h("div", {}, [ToggleList.view(searchList(props))]),
      h("div", {}, [ToggleList.view(recentList(props))]),
      h("div", {}, [ToggleList.view(linksList(props))]),
      h("div", {}, [ToggleList.view(backlinksList(props))]),
    ]),
    h("div", { class: "link-desc" }, [
      LinkNumberDec(props.note.links.length, false, false),
      LinkNumberDec(props.note.backlinks.length, true, false),
    ]),
    h("div", { class: "footer" }, [
      h("a", { class: "icon-wrap", onclick: ToggleLeft }, [
        h("i", { "data-feather": "chevrons-left", class: "icon" }),
      ]),
      publicContent(props),
    ]),
  ]);
};

// main mb 
const mobileMain = (props) => {
  const showContent = props.showLeft ? "content-mb-closed" : "content-mb-open";
  return h("div", { class: `${showContent}` }, [
    h("div", { class: "title-bar title-bar-mb" }, [
      h("div", { class: "titlebar-title" }, text(props.note.name)),
      h("div", { class: "titlebar-right" }, [
        props.view === "EDIT" ? editBtn(props) : viewBtn(props),
        props.note.is_public ? unlockBtn(props) : lockBtn(props),
      ]),
    ]),
    h("div", { class: `central-mb` }, [
      h("div", { class: "content-wrapper" }, [
        h("div", { id: "container", class: "main" }),
      ]),
    ]),
    h("div", { class: `footer footer-mb` }, [
      h("a", { class: "icon-wrap", onclick: ToggleLeft }, [
        h("i", { "data-feather": "chevrons-right", class: "icon" }),
      ]),
      h(
        "div",
        { class: "last-modified mlauto last-modified-mb truncated " },
        text(`${getlastEdited(props.note.last_modified)}`)
      ),
    ]),
  ]);
}

// 5. Misc Component Views

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

const publicContent = (props) => {
  const publicUrl = `${location.origin}/public/${props.note.name}`;
  return props.note.is_public === true
      ? h("div", { class: `mlauto url-content` }, [
          h("div", { class: `url-tag`}, text(`public url:${" "}`)),
          h(
            "a",
            { class: `url-wrapper truncated`, href: publicUrl },
            text(publicUrl)
          ),
        ])
      : h("div", { class: "url-content mlauto" }, [
          h("div", { class: "url-tag " }, text("")),
        ]);
};


const main = (props) => {
  return h("div", { class: "wrapper" }, 
  props.isMobile ? [mobileNav(props), mobileMain(props)] : [
    left(props),
    central(props),
    right(props),
  ]);
};

// SUBSCRIPTIONS

// S1. mobile switch handlers

const _onresize = (dispatch, options) => {
  const handler = () => dispatch(options.action);
  addEventListener("resize", handler);
  requestAnimationFrame(handler);
  return () => removeEventListener("resize", handler);
};

const onresize = (action) => [_onresize, { action }];

const ResizeHandler = (state) => {
  console.log("Resize triggered...", window.innerWidth, window.innerHeight);
  const newState = {
    ...state,
    isMobile: window.innerWidth < 768,
    showLeft: state.showLeft,
  };
  const rawMD = newState.note.content;
  const uniqueLinks = getUniqueLinks(rawMD);
  const lastEdited = newState.note.last_modified;
  requestAnimationFrame(() => {
    document.getElementById("container").innerHTML = "";
  })
  if (newState.view === "VIEW") {
    return [newState, [attachMarkdown, { rawMD, uniqueLinks }],[renderIcons]];
  } 
  return [
    newState,
    [
      attachCodeJar,
      { content: newState.note.content, cursorPos: newState.cursorPos },
    ],
    [renderIcons],
  ];
};

// S2. hash routing handlers
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
  const useCaching = false;
  return [
    newState,
    useCaching ? [
      lazyLoadNote,
      {
        state: newState,
      },
    ] : [getNoteFromServer, { state: newState, useCaching}],
    [renderIcons]
  ];
};

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
  cursorPos: null,
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
  isMobile: Math.min(window.innerWidth, window.innerHeight) < 768,
};

app({
  init: [initState, [renderIcons]],
  view: (state) => main(state),
  subscriptions: (state) => [
    onhashchange(HashHandler),
    onresize(ResizeHandler),
  ],
  node: document.getElementById("app"),
});

/*
note:
{
    name: str,
    content: str,
    links: [],
    backlinks: [],
    base_url: str,
    last_modified: str,
    is_public: bool,
    recent_notes: []
}
*/