import { h } from "https://unpkg.com/hyperapp@2.0.4/src/index.js";

const init = x => x

const toggle = x => x + "..."


const model = ({getter, setter}) => {

    const Toggle = state =>
         setter(state, toggle(getter(state)))

    return state => ({
        value: getter(state),
        Toggle,
    })
}

const view = model => h('div', {class: 'list-component'}, model.value)

export {init, model, view}