import React, { useRef, useState } from 'react'
import { navbarStyles } from '../assets/dummyStyles';
import logo from '../assets/logo.png';
import { Link, useNavigate } from 'react-router-dom';
import { SignedOut, useAuth, useClerk, useUser } from '@clerk/clerk-react';

const Navbar = () => {

    const [open, setOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    const { user } = useUser();
    const { getToken, isSignedIn } = useAuth();
    const clerk = useClerk();

    const navigate = useNavigate();
    const profileRef = useRef(null);
    const TOKEN_KEY = "token";

    //  to open login model
    function openSignIn() {
        try {
            if (clerk && typeof clerk.openSignIn === "function") {
                clerk.openSignIn();
            } else {
                navigate("/login");
            }
        } catch (e) {
            console.error("openSignin failed:", e);
            navigate("/login")
        }
    }

    // to open signup modal
    function openSignUp() {
        try {
            if (clerk && typeof clerk.openSignUp === "function") {
                clerk.openSignUp();
            } else {
                navigate("/signup");
            }
        } catch (e) {
            console.error("openSignup failed:", e);
            navigate("/signup")
        }
    }

    return (
        <header className={navbarStyles.header}>
            <div className={navbarStyles.container}>
                <nav className={navbarStyles.nav}>
                    <div className={navbarStyles.logoSection}>
                        <Link to='/' className={navbarStyles.logoLink}>
                            <img src={logo} alt={logo} className={navbarStyles.logoImage} />
                            <span className={navbarStyles.logoText}>
                                InvoiceAI
                            </span>
                        </Link>

                        <div className={navbarStyles.desktopNav}>
                            <a href='#features' className={navbarStyles.navLink}>
                                Features
                            </a>
                            <a href='#pricing' className={navbarStyles.navLinkInactive}>
                                Pricing
                            </a>
                        </div>
                    </div>

                    <div className='flex items-center gap-4'>
                        <div className={navbarStyles.authSection}>
                            <SignedOut>
                                <button onClick={openSignIn} className={navbarStyles.signInButton} type='button'>
                                    Sign in
                                </button>
                                <button onClick={openSignUp} className={navbarStyles.signUpButton} type='button'>
                                    <div className={navbarStyles.signUpOverlay}></div>
                                    <span className={navbarStyles.signUpText}>Get Started</span>
                                    <svg
                                        className={navbarStyles.signUpIcon}
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M5 12h14m-7-7l7 7-7 7" />
                                    </svg>
                                </button>
                            </SignedOut>
                        </div>

                        {/*mobile toggle  */}

                    </div>
                </nav>
            </div>
        </header>
    )
}

export default Navbar
