'use client';
import Link from "next/link";
import styles from "./NavBar.module.css";
import {useState, useEffect} from 'react';

export default function NavBar() {
    const [sudo, setSudo] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && window.localStorage.getItem("sudo") == "true") {
            setSudo(true);
        }
    }, [])

    return <nav className={styles.navbar}>
        <img className={styles.logo} src="/Team75LogoVUSE.png"></img>
        <div className={styles.pages}>
            <Link href="/team-view">Team View</Link>
            <Link href="/match-view">Match View</Link>
            <Link href="/picklist">Picklist</Link>
            {sudo && 
                <Link href='/sudo'>Sudo</Link>
            }
        </div>
    </nav>
}