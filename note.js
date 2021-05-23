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
const attachCodeJar = (dispatch, options) => {
  requestAnimationFrame(() => {
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
      content: newContent
    }
  };
};

const Edit = state => {
  const newState = {
    ...state,
    view: "EDIT"
  };
  return [newState,
    [attachCodeJar, { state: newState, UpdateContent }]
  ];
};

const Save = state => {
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
  return h("div", {class: "link-num-dec"}, `${length} ${backlinks ? "back" : ""}link${length > 1 ? "s" : ""}`)
}


const left =  props => {
  return h("div",  {class: "side-pane left-pane"}, [
    ToggleList("Search", dummyLinks),
    ToggleList("Recent", dummyLinks),
    h("div", {class: "footer"}, [])
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
    h("div", {class: "footer"}, [])
  ]);
}

const central = props => {
  const viewButton = props.view === "EDIT" ?
  h("button", { onclick: Save, class: "config-button" }, "save") :
  h("button", { onclick: Edit, class: "config-button" }, "edit");
  return h("div",  {class: "central-pane"}, [
    h("div", {class: "central-content-wrap"}, [
      h("div", { class: "title-bar" }, [
        h("div", { class: "titlebar-title" }, props.note.name),
        h("div", { class: "titlebar-right" }, [
          viewButton,
          h("a", { class: "config-button", href: "/" }, "share"),
        ])
      ]),
      h("div", { class: "content-wrapper" }, [
        h("div", { id: "container", class: "main" }),
      ])
    ]),
    h("div", {class: "footer"})
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
    ]
  ],
  view: state => main(state),
  node: document.getElementById("app")
});