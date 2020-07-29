/** input in html file by Jinja template
 * 
import { h, app } from "https://unpkg.com/hyperapp@2.0.4/src/index.js";
import { CodeJar } from 'https://medv.io/codejar/codejar.js';
let input = {{ note_data|tojson }};

*/

const converter = new showdown.Converter();
let jar;

// helpers
const linkSub = (rawMD, links, baseUrl) => {
  let newMD = rawMD;
  for (const each of links) {
      let replacement;
      if (each[2] !== "~") {
          const bareName = each.substring(2, each.length - 2);
          replacement = `[${bareName}](${baseUrl}notes/${encodeURI(bareName)})`;
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
      dispatch(options.updateContent(options.state, code)) // this is an old state
    );

  });
};

const updateDatabase = (dispatch, options) => {
  const note = options.state.note;
  note.links = options.bareLinks;
  const response = fetch(`${options.state.note.base_url}${options.state.note.name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options.state.note)
    });
};

const attachMarkdown = (dispatch, options) => {
  const convertedMarkdown = linkSub(options.state.note.content, options.uniqueLinks, options.state.note.base_url);
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
const updateContent = (state, newContent) => {
  return {
    ...state,
    note: {
      ...state.note,
      content: newContent
    }
  };
};

const edit = state => {
  const newState = {
    ...state,
    view: "EDIT"
  };
  return [newState,
    [attachCodeJar, { state: newState, updateContent }]
  ];
};

const save = state => {
  let markdown = state.note.content;
  const uniqueLinks = getUniqueLinks(markdown);
  const bareLinks = uniqueLinks.map(each =>
    each.substring(2, each.length - 2)
  ).filter(mappedEach => mappedEach[0] !== "~");
  return [
    {
      ...state,
      view: "VIEW",
      note: {
        ...state.note,
        content: markdown,
        links: bareLinks
      }
    },
    [attachMarkdown, { state, uniqueLinks }],
    [updateDatabase, { state, bareLinks }]
  ];
};

// views
const main = props => {
  return h("div", {class: "wrapper"}, [
    h("div", {class: "navbar"}, [
        h("div", {class: "navbar-left"}, [
            h("a", {class: "nav-button", href: props.note.base_url}, "home")
        ]),
        h("div", {class: "navbar-center"}, [
            h("div", {class: "navbar-title"}, props.note.name)
        ]),
        h("div", {class: "navbar-right"}, [
          props.view === "EDIT" ?
            h("button", { onclick: save, class: "nav-button" }, "save") :
            h("button", { onclick: edit, class: "nav-button" }, "edit")
        ])
    ]),
    h("div", {class: "content-wrapper"}, [
        h("div", { id: "container", class: "main" }),
        props.note.backlinks.length > 0 ?
        h("div", { class: "footer" }, [
            h("h2", {}, "Backlinks"),
            h("ul", {class: "backlink-list"},  [
                props.note.backlinks.map(link => 
                    h("li", {}, [
                        h("a", {href: `${props.note.base_url}notes/${link}`}, link)
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
        { state: initState, 
            uniqueLinks: getUniqueLinks(input.content)
        }
        ]
    ],
    view: state => main(state),
    node: document.getElementById("app")
});