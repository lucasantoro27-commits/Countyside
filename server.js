const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const session = require("express-session");

const app = express();

app.use(cors());
app.use(express.json());



app.set("trust proxy", 1);

app.use(
  session({
    secret: "CountrySideSuperSecret2026",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 12,
      sameSite: "lax",
      secure: false
    }
  })
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

function auth(req,res,next){

  if(req.session.auth){

    return next();

  }

  return res.status(401).json({
    error:"Non autorizzato"
  });

}

app.get("/api/debug",(req,res)=>{

  db.all(
    `
    SELECT id,data,stato
    FROM ordini
    ORDER BY id DESC
    `,
    [],
    (err,rows)=>{

      if(err){
        return res.status(500).json(err);
      }

      res.json(rows);

    }
  );

});

app.post("/api/login",(req,res)=>{

  const password =
    req.body.password;

  if(password === "CountrySide2026"){

    req.session.auth = true;

    req.session.save(()=>{

      res.json({
        success:true
      });

    });

    return;

  }

  return res.status(401).json({
    success:false
  });

});

app.post("/api/logout",(req,res)=>{

  req.session.destroy(()=>{

    res.json({
      success:true
    });

  });

});

app.get("/api/check-auth",(req,res)=>{

  res.json({
    auth: !!req.session.auth
  });

});

const db =
  new sqlite3.Database("database.db");

/* CREAZIONE TABELLA */

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS ordini (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT,
      stato TEXT,
      ordine TEXT
    )
  `);

});

app.post("/api/ordini", (req, res) => {

  db.get(
    `
    SELECT COUNT(*) as totale
    FROM ordini
    WHERE DATE(data)=DATE('now','localtime')
    `,
    [],
    (err,row)=>{

      if(err){

        return res.status(500).json({
          errore: err.message
        });

      }

      const numeroGiornaliero =
        row.totale + 1;

      const ordine = {

        numeroGiornaliero,

        data: new Date().toISOString(),

        messaggio: req.body.messaggio,

        totale: req.body.totale || 0,

        tipo: req.body.tipo || "",

        tavolo: req.body.tavolo || "",

        commensali: req.body.commensali || "",

        carrello: req.body.carrello || {}

      };

      db.run(
        `
        INSERT INTO ordini
        (
          data,
          stato,
          ordine
        )
        VALUES
        (
          ?,
          'nuovo',
          ?
        )
        `,
        [
          ordine.data,
          JSON.stringify(ordine)
        ],
        function(err){

          if(err){

            return res.status(500).json({
              errore: err.message
            });

          }

          res.json({
            success:true,
            id:this.lastID,
            numeroGiornaliero
          });

        }
      );

    }
  );

});

/* ELENCO ORDINI */

app.get("/api/ordini",auth, (req,res)=>{

  db.all(
    `
 SELECT *
    FROM ordini
    WHERE stato <> 'consegnato'
    ORDER BY id DESC
    `,
    [],
    (err,rows)=>{

      if(err){

        return res.status(500).json({
          errore: err.message
        });

      }

      res.json(rows);

    }
  );

});

/* CAMBIO STATO */

app.put("/api/ordini/:id/stato",auth, (req,res)=>{

  db.run(
    `
    UPDATE ordini
    SET stato = ?
    WHERE id = ?
    `,
    [
      req.body.stato,
      req.params.id
    ],
    err=>{

      if(err){

        return res.status(500).json(err);

      }

      res.json({
        success:true
      });

    }
  );

});

app.get("/api/statistiche",auth, (req,res)=>{

  db.all(
    `
SELECT *
FROM ordini
WHERE DATE(data)=DATE('now','localtime')
    `,
    [],
    (err,rows)=>{

      if(err){

        return res.status(500).json(err);

      }

      let nuovi = 0;
      let preparazione = 0;
      let consegnati = 0;
      let incasso = 0;

      rows.forEach(r=>{

        if(r.stato === "nuovo")
          nuovi++;

        if(r.stato === "preparazione")
          preparazione++;

        if(r.stato === "consegnato")
          consegnati++;

        try{

          const ordine =
            JSON.parse(r.ordine);

          incasso +=
            parseFloat(
              ordine.totale || 0
            );

        }catch(e){}

      });

      res.json({

        nuovi,

        preparazione,

        consegnati,

        totale: rows.length,

        incasso:
          incasso.toFixed(2)

      });

    }
  );

});

app.get("/api/prodotti/top",auth, (req,res)=>{

  db.all(
    `
SELECT *
FROM ordini
WHERE DATE(data)=DATE('now','localtime')
    `,
    [],
    (err,rows)=>{

      if(err){
        return res.status(500).json(err);
      }

      const prodotti = {};

      rows.forEach(r=>{

        try{

          const ordine =
            JSON.parse(r.ordine);

          const carrello =
            ordine.carrello || {};

          Object.values(carrello)
            .forEach(item=>{

              if(!prodotti[item.nome]){

                prodotti[item.nome] = 0;

              }

              prodotti[item.nome] +=
                item.qty;

            });

        }catch(e){}

      });

      const classifica =
        Object.entries(prodotti)

        .sort(
          (a,b)=>b[1]-a[1]
        );

      res.json(classifica);

    }
  );

});

app.get("/api/ordini/storico",auth, (req,res)=>{

  db.all(
    `
SELECT *
FROM ordini
WHERE stato='consegnato'
ORDER BY id DESC
    `,
    [],
    (err,rows)=>{

      if(err){

        return res.status(500).json(err);

      }

      res.json(rows);

    }
  );

});

app.get("/api/ordini/:id",auth, (req,res)=>{

  db.get(
    `
    SELECT *
    FROM ordini
    WHERE id = ?
    `,
    [req.params.id],
    (err,row)=>{

      if(err){

        return res.status(500).json(err);

      }

      res.json(row);

    }
  );

});

app.get("/api/statistiche/settimana",auth, (req,res)=>{

  db.all(
    `
    SELECT *
    FROM ordini
    WHERE DATE(data)
    BETWEEN DATE('now','-6 days','localtime')
    AND DATE('now','localtime')
    `,
    [],
    (err,rows)=>{

      if(err){
        return res.status(500).json(err);
      }

      let nuovi = 0;
      let preparazione = 0;
      let consegnati = 0;
      let incasso = 0;

      rows.forEach(r=>{

        if(r.stato === "nuovo")
          nuovi++;

        if(r.stato === "preparazione")
          preparazione++;

        if(r.stato === "consegnato")
          consegnati++;

        try{

          const ordine =
            JSON.parse(r.ordine);

          incasso +=
            parseFloat(
              ordine.totale || 0
            );

        }catch(e){}

      });

      res.json({

        nuovi,
        preparazione,
        consegnati,

        totale: rows.length,

        incasso:
          incasso.toFixed(2)

      });

    }
  );

});

app.get("/api/statistiche/mese",auth, (req,res)=>{

  db.all(
    `
    SELECT *
    FROM ordini
    WHERE strftime('%Y-%m', data)
    =
    strftime('%Y-%m', 'now', 'localtime')
    `,
    [],
    (err,rows)=>{

      if(err){
        return res.status(500).json(err);
      }

      let nuovi = 0;
      let preparazione = 0;
      let consegnati = 0;
      let incasso = 0;

      rows.forEach(r=>{

        if(r.stato === "nuovo")
          nuovi++;

        if(r.stato === "preparazione")
          preparazione++;

        if(r.stato === "consegnato")
          consegnati++;

        try{

          const ordine =
            JSON.parse(r.ordine);

          incasso +=
            parseFloat(
              ordine.totale || 0
            );

        }catch(e){}

      });

      res.json({

        nuovi,
        preparazione,
        consegnati,

        totale: rows.length,

        incasso:
          incasso.toFixed(2)

      });

    }
  );

});

app.get("/api/ordini/tutti",auth, (req,res)=>{

  db.all(
    `
    SELECT *
    FROM ordini
    ORDER BY id DESC
    `,
    [],
    (err,rows)=>{

      if(err){
        return res.status(500).json(err);
      }

      res.json(rows);

    }
  );

});

app.get("/api/prodotti/top/settimana",auth, (req,res)=>{

  db.all(
    `
    SELECT *
    FROM ordini
    WHERE DATE(data)
    BETWEEN DATE('now','-6 days','localtime')
    AND DATE('now','localtime')
    `,
    [],
    (err,rows)=>{

      if(err){
        return res.status(500).json(err);
      }

      const prodotti = {};

      rows.forEach(r=>{

        try{

          const ordine =
            JSON.parse(r.ordine);

          const carrello =
            ordine.carrello || {};

          Object.values(carrello)
            .forEach(item=>{

              if(!prodotti[item.nome]){

                prodotti[item.nome] = 0;

              }

              prodotti[item.nome] += item.qty;

            });

        }catch(e){}

      });

      const classifica =
        Object.entries(prodotti)
        .sort((a,b)=>b[1]-a[1]);

      res.json(classifica);

    }
  );

});

app.get("/api/prodotti/top/mese",auth, (req,res)=>{

  db.all(
    `
    SELECT *
    FROM ordini
    WHERE strftime('%Y-%m', data)
    =
    strftime('%Y-%m', 'now', 'localtime')
    `,
    [],
    (err,rows)=>{

      if(err){
        return res.status(500).json(err);
      }

      const prodotti = {};

      rows.forEach(r=>{

        try{

          const ordine =
            JSON.parse(r.ordine);

          const carrello =
            ordine.carrello || {};

          Object.values(carrello)
            .forEach(item=>{

              if(!prodotti[item.nome]){

                prodotti[item.nome] = 0;

              }

              prodotti[item.nome] += item.qty;

            });

        }catch(e){}

      });

      const classifica =
        Object.entries(prodotti)
        .sort((a,b)=>b[1]-a[1]);

      res.json(classifica);

    }
  );

});

app.get("/api/incassi/giornalieri",auth, (req,res)=>{

  db.all(
    `
    SELECT *
    FROM ordini
    WHERE stato='consegnato'
    ORDER BY data ASC
    `,
    [],
    (err,rows)=>{

      if(err){
        return res.status(500).json(err);
      }

      const giorni = {};

      rows.forEach(r=>{

        try{

          const ordine =
            JSON.parse(r.ordine);

          const giorno =
            r.data.substring(0,10);

          if(!giorni[giorno]){

            giorni[giorno] = 0;

          }

          giorni[giorno] +=
            parseFloat(
              ordine.totale || 0
            );

        }catch(e){}

      });

      res.json(giorni);

    }
  );

});

/* AVVIO SERVER */

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, ()=>{

  console.log(
    `Server attivo sulla porta ${PORT}`
  );

});
