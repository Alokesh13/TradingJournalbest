export function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#05070b",
      color: "white",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "sans-serif"
    }}>
      <div style={{display:"flex",gap:"60px",maxWidth:"1100px"}}>

        <div>
          <h1 style={{fontSize:"48px",fontWeight:"bold"}}>
            Record every trade
            <br/>
            like a desk-ready journal
          </h1>

          <p style={{marginTop:"20px",color:"#9ca3af"}}>
            A colorful trading dashboard for reviewing execution,
            screenshots, discipline, and performance in one place.
          </p>
        </div>

        <div style={{
          background:"#0b1220",
          padding:"30px",
          borderRadius:"12px",
          width:"320px"
        }}>
          <h2>Welcome back</h2>

          <input placeholder="Email"
            style={{width:"100%",marginTop:"15px",padding:"10px"}}
          />

          <input placeholder="Password"
            type="password"
            style={{width:"100%",marginTop:"10px",padding:"10px"}}
          />

          <button style={{
            marginTop:"20px",
            width:"100%",
            padding:"12px",
            background:"#22c55e",
            border:"none",
            color:"white",
            borderRadius:"8px"
          }}>
            Log in
          </button>

        </div>

      </div>
    </div>
  )
}
