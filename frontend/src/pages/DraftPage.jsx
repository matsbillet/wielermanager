const riders = [
    ['Tadej Pogačar', 'UAE Team Emirates', 'SLO', 485, 'P1', '+10 jersey'],
    ['Jonas Vingegaard', 'Visma-Lease a Bike', 'DEN', 445, 'P2', '+10 jersey'],
    ['Remco Evenepoel', 'Soudal Quick-Step', 'BEL', 398, 'P3', '+10 jersey'],
    ['Jasper Philipsen', 'Alpecin-Deceuninck', 'BEL', 372, 'P8', '+10 jersey'],
    ['Primož Roglič', 'Red Bull-BORA-hansgrohe', 'SLO', 156, 'DNF', ''],
    ['Mathieu van der Poel', 'Alpecin-Deceuninck', 'NED', 289, 'P12', ''],
    ['Wout van Aert', 'Visma-Lease a Bike', 'BEL', 312, 'P15', ''],
    ['Egan Bernal', 'INEOS Grenadiers', 'COL', 234, 'P18', '']
];

export default function DraftPage() {
    return (
        <div>
            <section className="banner card draft-board">
                <div className="banner-title">Draft Board</div>
                <div className="banner-sub">Snake Draft - Pro Peloton League</div>
                <div className="draft-order">
                    <div className="draft-slot panel"><strong>You</strong><span className="yellow">Picking now</span></div>
                    <div className="draft-slot panel"><strong>User 2</strong><span className="small-muted">Waiting</span></div>
                    <div className="draft-slot panel"><strong>User 3</strong><span className="small-muted">Waiting</span></div>
                    <div className="draft-slot panel"><strong>User 4</strong><span className="small-muted">Waiting</span></div>
                </div>
            </section>

            <section className="turn-banner">
                <div>
                    <div className="rider-name">It's Your Turn!</div>
                    <p>Select a rider to draft to your team</p>
                </div>
                <button className="pill-btn">Draft Rider</button>
            </section>

            <div className="section-head"><h2>Available Riders (8)</h2></div>
            <section className="riders-grid">
                {riders.map(([naam, team, land, pts, pos, bonus]) => (
                    <article key={naam} className="rider-card card">
                        <div className="rider-image">🚴</div>
                        <div className="rider-body">
                            <div className="rider-topline"><div className="rider-name">{naam}</div><div className="rider-country">{land}</div></div>
                            <div className="rider-team">{team}</div>
                            <div className="rider-meta">
                                <span className="yellow"><strong>↗ {pts}</strong> <span className="muted">pts</span></span>
                                <span className="muted">{pos}</span>
                                <span className="yellow">{bonus}</span>
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}