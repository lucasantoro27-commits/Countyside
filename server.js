const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

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

/* NUOVO ORDINE */

app.post("/api/ordini", (req, res) => {

const ordine = {
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
        id:this.lastID
      });

    }
  );

});

/* ELENCO ORDINI */

app.get("/api/ordini", (req,res)=>{

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

app.put("/api/ordini/:id/stato", (req,res)=>{

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

app.get("/api/statistiche", (req,res)=>{

  db.all(
    `
    SELECT *
    FROM ordini
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

app.get("/api/prodotti/top", (req,res)=>{

  db.all(
    `
    SELECT *
    FROM ordini
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

app.get("/api/ordini/storico", (req,res)=>{

  db.all(
    `
    SELECT *
    FROM ordini
    WHERE stato = 'consegnato'
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

app.get("/api/ordini/:id", (req,res)=>{

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

/* AVVIO SERVER */

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, ()=>{

  console.log(
    `Server attivo sulla porta ${PORT}`
  );

});