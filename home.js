/** input in index.html by Jinja template
 import { h, app } from "https://unpkg.com/hyperapp@2.0.4/src/index.js";
 let base_url = {{base_url|tojson }};
 {{home_js}}
 */

// effects
const getNotes = async (dispatch, options) => {
    const searchTerm = options.state.toSearch;
    const rawResponse = await fetch(`/search/${searchTerm}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    let links = await rawResponse.json();
    dispatch(options.addNotes(options.state, links));
};

// actions

const addNotes = (state, notes) => ({
    ...state,
    hasSearched: true,
    links: notes
});

const newToSearch = (state, val) => {
    return {
        ...state,
        hasSearched: false,
        toSearch: val,
    };
};

const search = state => {
    return [state,
        [getNotes, { state, addNotes }]
    ];
};

const results = props => {
    return h("div", { class: "home-right" }, [
        h("h2", {}, "Results"),
        h("ul", { class: "backlink-list" }, [
            props.links.map(link =>
                h("li", {}, [
                    h("a", { href: `/notes/${link}` }, link)
                ])
            )
        ])
    ]);
};

const main = props => {
    let goToNote = props.toSearch;
    if (goToNote === "") {
        goToNote = "getting_started";
    }
    return h("div", { class: "home-wrapper" }, [
        h("div", { class: "home-left" }, [
            h("h1", {}, "yarc"),
            h("input", { class: "search-bar", type: "text", oninput: [newToSearch, (event) => event.target.value] }),
            h("div", { class: "search-wrapper" }, [
                h("button", { onclick: search, class: "nav-button", id: "mr10" }, "search"),
                h("a", { href: `/notes/${goToNote}`, class: "nav-button" }, "go")
            ])
        ]),
        props.links.length > 0 ? results(props) :
            props.toSearch !== "" && props.hasSearched ? h("h4", { class: "home-right" }, "No Results (click 'go' to create)") : null,
    ]);
};


const initState = {
    base_url: base_url,
    toSearch: "",
    hasSearched: false,
    links: []
};

app({
    init: initState,
    view: state => main(state),
    node: document.getElementById("app")
});