/** input in html file by Jinja template
 * 
import { h, app } from "https://unpkg.com/hyperapp@2.0.4/src/index.js";
let input = {{ note_data|tojson }};

*/

const converter = new showdown.Converter();


// helpers
const linkSub = (rawMD, links) => {
  let newMD = rawMD;
  for (const each of links) {
    let replacement;
    if (each[2] !== "~") {
      const bareName = each.substring(2, each.length - 2);
      replacement = `[${bareName}](/public/${encodeURI(bareName)})`;
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

// effects
const renderIcons = (dispatch, options) => {
  requestAnimationFrame(() => {
    feather.replace();
  });
};

const attachMarkdown = (dispatch, options) => {
  const convertedMarkdown = linkSub(
    options.state.note.content,
    options.uniqueLinks
  );
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
    },
  };
};

const collapseLeft = (state) => {
  const newState = {
    ...state,
    collapse_left: !state.collapse_left,
    note: {
      ...state.note,
    },
  };

  return [newState, [renderIcons]];
};


// views

const ToggleList = (title, links) => {
  return h("div", { class: "toggle-list" }, [
    h("div", { class: "toggle-title" }, title),
    links.map((link) =>
      h("a", { href: `/public/${link}`, class: "toggle-link" }, link)
    ),
  ]);
};

const LinkNumberDec = (length, backlinks = true, collapsed) => {
  if (collapsed) {
    return h("div", { class: "link-num-dec icons-top" }, `${length}`);
  }
  return h(
    "div",
    { class: "link-num-dec" },
    `${length} ${backlinks ? "back" : ""}link${length !== 1 ? "s" : ""}`
  );
};

const left = (props) => {
  if (props.collapse_left) {
    return h("div", { class: "side-pane-collapsed left-pane-collapsed" }, [
      LinkNumberDec(props.note.links.length, false, true),
      LinkNumberDec(props.note.backlinks.length, true, true),
      h("div", { class: "footer" }, [
        h("a", { class: "icon-wrap", onclick: collapseLeft }, [
          h("i", { "data-feather": "chevrons-left", class: "icon" }),
        ]),
      ]),
    ]);
  }
  return h("div", { class: "side-pane left-pane" }, [
    h("div", { class: "right-content-wrap" }, [
      ToggleList("Links", props.note.links),
      ToggleList("Backlinks", props.note.backlinks),
    ]),
    LinkNumberDec(props.note.links.length, false, false),
    LinkNumberDec(props.note.backlinks.length, true, false),
    h("div", { class: "footer" }, [
      h("a", { class: "knotro-wrap" }, "knotro.com"),
      h("a", { class: "icon-wrap mlauto", onclick: collapseLeft }, [
        h("i", { "data-feather": "chevrons-left", class: "icon" }),
      ]),
    ]),
  ]);
};

const central = (props) => {
  const public_url = ` ${location.origin}/public/${props.note.name}`;

  const svg = `<svg width="32" height="32" viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g clip-path="url(#deta_new_svg__clip0)"><path d="M111.14 0c61.38 0 111.139 49.705 111.139 111.02S172.52 222.04 111.14 222.04C49.759 222.04 0 172.335 0 111.02S49.759 0 111.14 0z" fill="#EF39A8"></path><path d="M111.404 21.676c49.689 0 89.97 40.237 89.97 89.873s-40.281 89.873-89.97 89.873-89.97-40.237-89.97-89.873 40.281-89.873 89.97-89.873z" fill="#BD399C"></path><path d="M111.404 45.465c36.536 0 66.154 29.586 66.154 66.084 0 36.497-29.618 66.083-66.154 66.083S45.25 148.046 45.25 111.549c0-36.498 29.618-66.084 66.154-66.084z" fill="#93388E"></path><path d="M110.874 65.555c24.844 0 44.985 20.119 44.985 44.937 0 24.817-20.141 44.936-44.985 44.936s-44.985-20.119-44.985-44.936c0-24.818 20.141-44.937 44.985-44.937z" fill="#6030A2"></path><path d="M339 170.836h49.915c23.004 0 40.365-5.842 51.867-17.745 11.719-11.902 17.579-25.752 17.579-41.983 0-16.23-5.86-30.296-17.579-42.199-11.502-11.902-28.863-17.745-51.867-17.745H339v119.672zm96.574-59.728c0 11.686-3.907 21.641-11.719 29.864-7.596 8.007-19.315 12.119-34.94 12.119h-27.779V68.909h27.779c15.625 0 27.344 4.112 34.94 12.119 7.812 8.223 11.719 18.178 11.719 30.08zm40.582 10.388c0 30.08 19.098 51.504 52.302 51.504 22.136 0 39.931-10.604 47.744-30.513h-24.523c-5.426 8.44-13.022 12.768-23.221 12.768-16.928 0-27.778-10.82-29.732-27.7h79.212v-6.059c0-29.648-19.966-51.505-50.782-51.505-31.034 0-51 21.208-51 51.505zm78.995-8.224h-56.208c2.388-14.932 11.936-25.535 28.213-25.535 15.843 0 25.608 10.387 27.995 25.535zm73.353 20.992V88.386h24.957v-16.23h-24.957V49h-21.702v23.155h-16.06v16.23h16.06v45.879c0 14.499 3.038 24.237 9.332 29.431 6.293 5.193 15.191 7.79 26.693 7.79 3.69 0 6.944-.216 9.766-.865l4.123-.866v-17.096l-4.123.433c-2.822.433-6.076.649-9.766.649-11.719 0-14.323-6.059-14.323-19.476zm93.101-63.624c-14.54 0-25.825 3.03-33.638 9.306-8.029 6.276-11.936 13.85-11.936 22.723h22.136c0-10.388 11.719-14.283 23.438-14.283 14.757 0 23.872 5.193 23.872 18.827v6.059h-26.693c-26.259 0-46.659 6.709-46.659 28.782 0 20.342 15.625 30.946 38.847 30.946 14.973 0 25.607-3.679 31.901-11.037l3.039-3.678c0 4.111 1.735 10.387 2.386 12.551H770v-1.731l-1.519-4.761c-.868-3.246-1.302-8.223-1.302-15.148v-38.088c0-28.998-16.493-40.468-45.574-40.468zm23.872 57.131c0 19.693-9.982 29.864-28.863 29.864-12.37 0-22.354-4.111-22.354-14.499 0-11.902 10.852-15.365 24.524-15.581l26.693.216z" fill="#000"></path></g><defs><clipPath id="deta_new_svg__clip0"><path fill="#fff" d="M0 0h770v222.04H0z"></path></clipPath></defs>
  </svg>`;

  return h("div", { class: "central-pane" }, [
    h("div", { class: "central-content-wrap" }, [
      h("div", { class: "title-bar" }, [
        h("div", { class: "titlebar-title" }, props.note.name),
      ]),
      h("div", { class: "content-wrapper" }, [
        h("div", { id: "container", class: "main" }),
      ]),
    ]),
    h("div", { class: "footer" }, [
      h("a", { class: "sponsor", href:"https://deta.space/discovery/yarc" }, [
        h("div", { innerHTML: svg, class: "sponsor-svg" }),
        h("div", { class: "sponsor-message" }, "Install on Deta"),
      ]),

      h("div", { class: "url-content mlauto" }, [
        h("div", { class: "url-tag " }, "public url: "),
        h("a", { class: "url-wrapper ", href: public_url }, public_url),
      ]),
    ]),
  ]);
};

const main = (props) => {
  console.log(props);
  return h("div", { class: "wrapper" }, [left(props), central(props)]);
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
  note: input,
  collapse_left: false 
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
