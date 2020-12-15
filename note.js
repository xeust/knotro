/** input in html file by Jinja template
 * 
import { h, app } from "https://unpkg.com/hyperapp@2.0.4/src/index.js";
import { CodeJar } from 'https://medv.io/codejar/codejar.js';
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
    container.classList.add("markdown");

    const highlight = editor => {
      editor.textContent = editor.textContent;
      hljs.highlightBlock(editor);
    };

    jar = CodeJar(container, highlight);
    jar.updateCode(options.state.note.content);
    jar.onUpdate(code =>
      dispatch(options.UpdateContent(options.state, code)) // this is an old state
    );

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
    container.removeAttribute("style");
    container.removeAttribute("contenteditable");
    container.removeAttribute("spellcheck");
    container.classList.remove("hljs");
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
const main = props => {
  return h("div", { class: "wrapper" }, [
    h("div", { class: "navbar" }, [
      h("div", { class: "navbar-left" }, [
        h("a", { class: "nav-button", href: "/" }, "home")
      ]),
      h("div", { class: "navbar-center" }, [
        h("div", { class: "navbar-title" }, props.note.name)
      ]),
      h("div", { class: "navbar-right" }, [
        props.view === "EDIT" ?
          h("button", { onclick: Save, class: "nav-button" }, "save") :
          h("button", { onclick: Edit, class: "nav-button" }, "edit")
      ])
    ]),
    h("div", { class: "content-wrapper" }, [
      h("div", { id: "container", class: "main" }),
      props.note.backlinks.length > 0 ?
        h("div", { class: "footer" }, [
          h("h2", {}, "Backlinks"),
          h("ul", { class: "backlink-list" }, [
            props.note.backlinks.map(link =>
              h("li", {}, [
                h("a", { href: `/notes/${link}` }, link)
              ])
            )
          ])
        ]) : null
    ])
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