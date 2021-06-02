/** input in html file by Jinja template
 * 
import { h, app } from "https://unpkg.com/hyperapp@2.0.4/src/index.js";
let input = {{ note_data|tojson }};

*/

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

const getUniqueLinks = rawMD => {
  const uniqueLinks = [...new Set(rawMD.match(/\[\[(.*?)\]]/g))];
  return uniqueLinks;
};

// effects
const renderIcons = (dispatch, options) => {
  requestAnimationFrame(() => {
      feather.replace();
  });
}


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
      mode: 'markdown'
    });

    jar.on("change", function (cm, change) {
      dispatch(options.UpdateContent(options.state, cm.getValue()))

      clearTimeout(timeout);

      timeout = setTimeout(function () {
        dispatch(options.DebounceSave(dispatch, options.state, cm.getValue()))
        console.log("...")
      }, 1000)
    })

  });
};

const updateDatabase = (dispatch, options) => {
  const response = fetch(`/${options.note.name}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options.note)
  });
};

const modifyPublic = (dispatch, options) => {
  const response = fetch(`/public/${options.note.name}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({is_public: options.note.is_public})
  });
};

const attachMarkdown = (dispatch, options) => {
  const convertedMarkdown = linkSub(options.state.note.content, options.uniqueLinks);
  const html = converter.makeHtml(convertedMarkdown);
  requestAnimationFrame(() => {
    const container = document.getElementById("container");
    container.innerHTML = html;
  });
};

// actions
const UpdateContent = (state, newContent) => {
  return {
    ...state,
    note: {
      ...state.note,
      content: newContent,
      last_modified: "saving"
    }
  };
};

const setStatus = (state, status) => {
  return {
    ...state,
    note: {
      ...state.note,
      last_modified: status
    }
  };
}

const DebounceSave =  (dispatch, state, newContent) => {
  const newState = {
    ...state,
    note:{
      ...state.note,
      content: newContent,
      last_modified: "saving"
    }
  }

  const resp = fetch(`/${newState.note.name}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newState.note)
  }).then(res=> {
    if (res.status === 200) {
      console.log("saved")
      dispatch(setStatus(newState, new Date().toUTCString()))
    } 
  }).catch((err)=> {
    console.log("error")
    dispatch(setStatus(newState, "failed to save"))
  })
  return newState;

}

const Edit = state => {
  const newState = {
    ...state,
    view: "EDIT"
  };
  return [newState,
    [attachCodeJar, { state: newState, UpdateContent, DebounceSave }]
  ];
};

const getlastEdited = (lastModified) => {
  if (lastModified === "saving" || lastModified === "failed to save") {
    return lastModified
  }
  const date = new Date(lastModified);

  let elapsed = Math.abs(new Date() - date)/1000;

  const days = Math.floor(elapsed / 86400);
  elapsed -= days * 86400;


  // calculate hours
  const hours = Math.floor(elapsed / 3600) % 24;
  elapsed -= hours * 3600;


  // calculate minutes
  const minutes = Math.floor(elapsed / 60) % 60;
  elapsed -= minutes * 60;

  if (days < 1 || days === NaN){
    if (hours < 1 || hours === NaN) {
      return `last edited: ${minutes} minutes ago`
    } else {
      return `last edited: ${hours} hours ago`
    }
  } else {
    return `last edited: ${days} days ago`
  }

}
const View = state => {
  let markdown = state.note.content;
  const uniqueLinks = getUniqueLinks(markdown);
  const bareLinks = uniqueLinks.map(each =>
    each.substring(2, each.length - 2)
  ).filter(mappedEach => mappedEach[0] !== "~");

  const newState = {
    ...state,
    view: "VIEW",
    note: {
      ...state.note,
      last_modified: new Date().toUTCString(),
      content: markdown,
      links: bareLinks
    }
  };
  return [
    newState,
    [attachMarkdown, { state, uniqueLinks }],
    [updateDatabase, { note: newState.note }]
  ];
};

const Share = state => {

  const newState = {
    ...state,
    view: "VIEW",
    note: {
      ...state.note,
      is_public: !state.note.is_public
    }
  };

  return [
    newState,
    [modifyPublic, {note: newState.note}],
    [renderIcons]
  ];
}

// views

const dummyLinks = ["one", "two", "three", "four"];

const ToggleList = (title, links) => {
  return h("div", {class: "toggle-list"}, [
    h("div", {class: "toggle-title"}, title),
    links.map(link => 
      h("a", { href: `/notes/${link}`, class: "toggle-link"}, link)
    )
  ]);
}

const LinkNumberDec = (length, backlinks = true) => {
  return h("div", {class: "link-num-dec"}, `${length} ${backlinks ? "back" : ""}link${length !== 1 ? "s" : ""}`)
}


const left =  props => {
  return h("div",  {class: "side-pane left-pane"}, [
    ToggleList("Search", dummyLinks),
    ToggleList("Recent", dummyLinks),
    h("div", {class: "footer"}, [
      h("a", {class: "icon-wrap mlauto"}, [
        h("i", { "data-feather": "chevrons-left", class: "icon" })
      ])
    ])
  ]);
}

const right =  props => {
  return h("div",  {class: "side-pane right-pane"}, [
    h("div", {class: "right-content-wrap"}, [
      ToggleList("Links", props.note.links),
      ToggleList("Backlinks", props.note.backlinks),
    ]),
    LinkNumberDec(props.note.links.length, false),
    LinkNumberDec(props.note.backlinks.length),
    h("div", {class: "footer"}, [
      h("a", {class: "icon-wrap"}, [
        h("i", { "data-feather": "chevrons-right", class: "icon" })
      ])
    ])
  ]);
}

const central = props => {

  const public_url = `${location.origin}/public/${props.note.name}`;

  const viewButton = props.view === "EDIT" ?
  h("button", { onclick: View, class: "config-button" }, "view") :
  h("button", { onclick: Edit, class: "config-button" }, "edit");

  const public_content = props.note.is_public === true ? 
  h("div", { class: "url-content mlauto" }, [
    h("div", { class: "url-tag " }, "public url: "),
    h("a", { class: "url-wrapper ", href: public_url }, public_url),
  ]) : 
  h("div", { class: "url-content mlauto" }, [
    h("div", { class: "url-tag " }, ""),
  ]);

  const shareButton = props.note.is_public === true ?
  h("button", { onclick: Share, class: "config-button" }, "unlock") :
  h("button", { onclick: Share, class: "config-button" }, "lock");

  return h("div",  {class: "central-pane"}, [
    h("div", {class: "central-content-wrap"}, [
      h("div", { class: "title-bar" }, [
        h("div", { class: "titlebar-title" }, props.note.name),
        h("div", { class: "titlebar-right" }, [
          viewButton,
          shareButton
        ])
      ]),
      h("div", { class: "content-wrapper" }, [
        h("div", { id: "container", class: "main" }),
      ])
    ]),
    h("div", {class: "footer"}, [
      h("div", {class:"last-modified"}, `${getlastEdited(props.note.last_modified)}`),
      public_content,
    ])
  ]);
}


const main = props => {

  return h("div", { class: "wrapper" }, [
    left(props),
    central(props),
    right(props)
  ]);
};


/*
note:
{
    name: str,
    content: str,
    links: [],
    backlinks: [],
    base_url: str
}
*/


const initState = {
  view: "VIEW",
  note: input
};

app({
  init: [initState,
    [
      attachMarkdown,
      {
        state: initState,
        uniqueLinks: getUniqueLinks(input.content)
      }
    ],
    [renderIcons]
  ],
  view: state => main(state),
  node: document.getElementById("app")
});