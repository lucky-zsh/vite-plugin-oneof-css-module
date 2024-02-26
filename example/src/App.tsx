

import $style from './App.scss'
import "./index.scss"
function App () {
    return (
        <div className={$style.app}>
            我是APP
            <div className='header'></div>
            <div className={$style.body}>
                我是body
            </div>
        </div>
    )
}

export default App
