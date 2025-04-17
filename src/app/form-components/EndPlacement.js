import { useEffect, useState } from 'react';
import styles from './EndPlacement.module.css'

export default function EndPlacement () {

    const [endLocation, setEndLocation] = useState(0);

    return (
        <div className={styles.endPossibilities}>
            <div className={styles.option} onClick={(e) => {e.target.querySelector("input")?.click();}}>
                <input name="endlocation" type="radio" id="None" value={0} defaultChecked onChange={(e) => setEndLocation(e.target.value)}></input>
                <label htmlFor="None">None</label>
            </div>
            <div className={styles.option} onClick={(e) => {e.target.querySelector("input")?.click();}}>
                <input name="endlocation" type="radio" id="Park" value={1} onChange={(e) => setEndLocation(e.target.value)}></input>
                <label htmlFor="Park">Park</label>
            </div>
            <div className={styles.option} onClick={(e) => {e.target.querySelector("input")?.click();}}>
                <input name="endlocation" type="radio" id="FailAndPark" value={2} onChange={(e) => setEndLocation(e.target.value)}></input>
                <label htmlFor="FailAndPark">Failed Climb</label>
            </div>
            <div className={styles.option} onClick={(e) => {e.target.querySelector("input")?.click();}}>
                <input name="endlocation" type="radio" id="ShallowSuccess" value={3} onChange={(e) => setEndLocation(e.target.value)}></input>
                <label htmlFor="ShallowSuccess">Shallow Cage</label>
            </div>
            <div className={styles.option} onClick={(e) => {e.target.querySelector("input")?.click();}}>
                <input name="endlocation" type="radio" id="DeepSuccess" value={4} onChange={(e) => setEndLocation(e.target.value)}></input>
                <label htmlFor="DeepSuccess">Deep Cage</label>
            </div>
        </div>
    )
}