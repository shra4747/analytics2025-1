"use client";
import { useState } from 'react';
import styles from './NumericInput.module.css';

export default function NumericInput({ visibleName, internalName, pieceType, min, max }) {
    min = min || 0;
    max = max || 99999;

    const [value, setValue] = useState(0);

    function checkAutoTotal() {
        if (internalName.startsWith('auto')) {
            const autoFields = [
                'autol1success', 'autol1fail',
                'autol2success', 'autol2fail',
                'autol3success', 'autol3fail',
                'autol4success', 'autol4fail'
            ];
            
            const total = autoFields.reduce((sum, field) => {
                const input = document.querySelector(`input[name="${field}"]`);
                const val = input ? +input.value : 0;
                return sum + val;
            }, 0);
            
            if (total > 4) {
                return confirm("Are you sure this is in Autonomous? The total coral attempts seem high. Please fix it if scoring is wrong.");
            }
        }
        return true;
    }

    function increment() {
        if (value + 1 <= max) {
            if (checkAutoTotal()) {
                setValue(value + 1);
            }
        }
    }

    function decrement() {
        if (value - 1 >= min) {
            setValue(value - 1);
        }
    }

    return (
        <div className={styles.NumericInput}>
            <label className={styles.label} htmlFor={internalName}>{visibleName}</label>
            <div className={styles.Container}>
                <button type="button" className={styles[pieceType + 'ButtonLeft']} onClick={decrement}><h1><strong>-</strong></h1></button>
                <input
                    className={styles[pieceType]}
                    type="number"
                    id={internalName}
                    name={internalName}
                    value={value}
                    readOnly
                />
                <button type="button" className={styles[pieceType + 'ButtonRight']} onClick={increment}><h1><strong>+</strong></h1></button>
            </div>
            <br/>
        </div>
    )
}