import type { PagesLegales } from "./types";

export const LEGAL_SV: PagesLegales = {
  avertissement: "Denna översättning tillhandahålls endast i informationssyfte; vid avvikelse har den franska versionen företräde.",
  accepterCgv: "Genom att beställa godkänner du våra [allmänna försäljningsvillkor](/cgv).",

  cgv: {
    titre: "Allmänna Försäljningsvillkor",
    miseAJour: "Senast uppdaterad: 1 oktober 2026",
    sections: [
      {
        titre: "Artikel 1 — Syfte",
        blocs: [
          "Dessa Allmänna Försäljningsvillkor (villkoren) reglerar försäljning av produkter och tjänster som utförs av bolaget {raison}, med ett aktiekapital på {capital}, med säte på adressen {siege}, registrerat i det franska handels- och bolagsregistret (RCS) under nummer {rcs}, nedan kallat ”Cartoonova”.",
          "De gäller för varje beställning som görs på webbplatsen **cartoonova.com** (nedan ”Webbplatsen”) av en privat- eller företagskund (nedan ”Kunden”).",
          "Genom att göra en beställning på Webbplatsen godkänner Kunden dessa villkor fullt ut och utan förbehåll.",
        ],
      },
      {
        titre: "Artikel 2 — Produkter och tjänster",
        blocs: [
          "Cartoonova erbjuder en tjänst för att skapa karikatyrer och personliga porträtt i cartoonstil, utförda utifrån de foton som Kunden tillhandahåller. De erbjudna produkterna omfattar:",
          {
            liste: [
              "Digitala filer (JPG, PNG i hög upplösning)",
              "Tryck på poster",
              "Tryck på canvas (duk)",
              "Tryck som inramat porträtt",
              "Tryck på mugg",
              "Tryck på Alu-Dibond",
            ],
          },
          "De fotografier och illustrationer som visas på Webbplatsen är så trogna som möjligt. Smärre variationer kan dock förekomma mellan den beställda och den mottagna produkten, eftersom varje karikatyr är ett unikt och hantverksmässigt skapat verk.",
        ],
      },
      {
        titre: "Artikel 3 — Priser",
        blocs: [
          "Priserna anges i euro (€), inklusive alla skatter och avgifter. Cartoonova förbehåller sig rätten att när som helst ändra sina priser. Produkterna faktureras enligt det pris som gäller när beställningen bekräftas.",
          "Trycken (poster, duk, inramat porträtt) levereras mot en fast leveransavgift som läggs till produkternas pris och anges innan beställningen slutligen bekräftas. Den digitala filen, som skickas via e-post, medför ingen leveransavgift.",
        ],
      },
      {
        titre: "Artikel 4 — Beställning",
        blocs: [
          "Kunden väljer önskade anpassningsalternativ (format, antal personer/djur, bakgrund, tryckmaterial) och laddar upp de foton som behövs för att skapa karikatyren.",
          "Beställningen bekräftas genom full betalning av priset. Ett bekräftelsemejl skickas till Kunden till den e-postadress som angavs vid beställningen.",
          "Cartoonova förbehåller sig rätten att vägra eller annullera en beställning vid en pågående tvist, olämpliga foton eller uppenbart felaktiga uppgifter.",
        ],
      },
      {
        titre: "Artikel 5 — Betalning",
        blocs: [
          "Betalning sker online med bankkort (Visa, Mastercard, American Express) eller via PayPal. Betalningen skyddas av ett SSL-krypteringssystem.",
          "Hela beloppet debiteras när beställningen bekräftas. Ingen beställning behandlas innan full betalning har mottagits.",
        ],
      },
      {
        titre: "Artikel 6 — Framställnings- och leveranstider",
        blocs: [
          "Framställningstiden för en karikatyr är i regel **2 arbetsdagar** räknat från mottagandet av betalningen och fotona. Tiden kan variera beroende på beställningens komplexitet och konstnärernas arbetsbelastning.",
          "**Digitala produkter:** Filen i hög upplösning skickas via e-post till Kunden så snart karikatyren är klar. Kunden kan därefter begära ändringar (artikel 7).",
          "**Tryckta produkter:** En förhandsvisning skickas till Kunden, som godkänner den före tryck. Tryck och leverans tar därefter 3 till 7 arbetsdagar beroende på destination. Leveransavgifter och leveranstider anges vid beställningen.",
          "**Expressalternativ:** när Kunden har valt det levereras karikatyren inom 24 timmar, även på helger, räknat från mottagandet av betalningen och fotona. För en tryckt produkt avser denna tid teckningen; tryck och leverans följer därefter ovanstående tider.",
          "Cartoonova ansvarar inte för leveransförseningar som kan tillskrivas transportören eller beror på force majeure.",
        ],
      },
      {
        titre: "Artikel 7 — Ändringar och nöjdhet",
        blocs: [
          "Cartoonova åtar sig att leverera ett kvalitativt arbete som är troget de tillhandahållna fotona. Kunden har rätt till **kostnadsfria och obegränsade ändringar** tills Kunden är helt nöjd.",
          "Begäran om ändringar ska framföras tydligt och precist via e-post till support@cartoonova.com.",
          "Ändringarna avser rimliga justeringar (likhet, färger, detaljer). De omfattar inte en fullständig ändring av den stil eller komposition som ursprungligen godkänts.",
          "**Nöjdhetsgaranti.** Om karikatyren efter ändringarna fortfarande inte passar Kunden återbetalar Cartoonova hela det betalda priset, på enkel begäran till support@cartoonova.com. För en tryckt produkt ska begäran göras **innan förhandsvisningen godkänns**: när förhandsvisningen har godkänts startas trycket och produkten omfattas då av artikel 9.",
        ],
      },
      {
        titre: "Artikel 8 — Ångerrätt",
        blocs: [
          "I enlighet med artikel L221-28 i den franska konsumentlagen (Code de la consommation) **kan ångerrätten inte utövas** för avtal om leverans av varor som tillverkats enligt konsumentens specifikationer eller som tydligt har anpassats till konsumenten.",
          "Eftersom varje karikatyr är ett unikt verk som skapas på beställning utifrån Kundens foton och instruktioner omfattas beställningar av digitala produkter inte av ångerrätten när skapandet har påbörjats.",
          "För tryckta produkter gäller att om den mottagna produkten är skadad eller inte överensstämmer med beställningen kan Kunden kontakta kundtjänst inom 14 dagar efter mottagandet för att få ett utbyte eller en återbetalning.",
        ],
      },
      {
        titre: "Artikel 9 — Återbetalning",
        blocs: [
          "Återbetalning beviljas i två fall: enligt nöjdhetsgarantin i artikel 7, eller när en tryckt produkt tas emot defekt eller inte överensstämmer med beställningen. I det senare fallet gör Cartoonova, enligt Kundens val, ett utbyte eller en fullständig återbetalning.",
          "Återbetalningen görs till det betalningsmedel som användes vid beställningen, inom 14 dagar efter att begäran har godkänts.",
          "Begäran om återbetalning ska skickas till support@cartoonova.com tillsammans med ordernumret och en beskrivning av problemet.",
        ],
      },
      {
        titre: "Artikel 9 bis — Presentkort",
        blocs: [
          "Cartoonova erbjuder presentkort med ett fast belopp, som betalas online och levereras via e-post i form av en kod och en utskriftsvänlig version.",
          "Presentkortet är giltigt i **12 månader** från köpet, i köpets valuta. Det kan användas för en eller flera beställningar tills saldot är förbrukat. Varje beställning innebär ett minimibelopp på 1 (i beställningens valuta) som Kunden själv betalar; det outnyttjade saldot förblir tillgängligt.",
          "Presentkortet kan varken återbetalas eller växlas mot kontanter. Ångerrätten på 14 dagar gäller för köpet av presentkortet så länge det inte har använts: återbetalning kan då begäras via support@cartoonova.com.",
        ],
      },
      {
        titre: "Artikel 10 — Immateriella rättigheter",
        blocs: [
          "De karikatyrer som skapas av Cartoonova är originalverk som skyddas av upphovsrätten. Efter full betalning erhåller Kunden en **personlig och icke-kommersiell nyttjanderätt** till verket.",
          "Cartoonova förbehåller sig rätten att använda de utförda karikatyrerna i marknadsföringssyfte (portfolio, sociala medier), om inte Kunden uttryckligen begär annat.",
        ],
      },
      {
        titre: "Artikel 11 — Ansvar",
        blocs: [
          "Cartoonova ansvarar inte för Kundens användning av de levererade karikatyrerna. Kunden garanterar att Kunden har de rättigheter som krävs till de överlämnade fotona och att Kunden inte använder dem i ärekränkande eller olagliga syften.",
        ],
      },
      {
        titre: "Artikel 12 — Dataskydd",
        blocs: [
          "Personuppgifter som samlas in i samband med beställningar behandlas i enlighet med vår [Integritetspolicy](/politique-de-confidentialite).",
          "De foton som Kunden överlämnar används uteslutande för att utföra beställningen och raderas inom 90 dagar efter leverans, om inte Kunden begär att de ska sparas.",
        ],
      },
      {
        titre: "Artikel 13 — Medling och tvister",
        blocs: [
          "Vid en tvist uppmanas Kunden att i första hand kontakta Cartoonovas kundtjänst på support@cartoonova.com för att söka en uppgörelse i godo.",
          "I enlighet med artikel L611-1 och följande i den franska konsumentlagen (Code de la consommation) kan Kunden kostnadsfritt vända sig till en konsumentmedlare för att lösa tvisten i godo.",
          "Om ingen uppgörelse i godo nås är domstolarna i Paris ensamt behöriga. Dessa villkor omfattas av fransk lag.",
        ],
      },
      {
        titre: "Artikel 14 — Kontakt",
        blocs: [
          "För alla frågor om din beställning eller om dessa villkor:",
          { lignes: ["**{raison}**", "{siege}", "Tel.: {tel}", "E-post: support@cartoonova.com"] },
        ],
      },
    ],
  },

  mentions: {
    titre: "Juridisk Information",
    miseAJour: "Senast uppdaterad: 21 mars 2024",
    sections: [
      {
        titre: "1. Webbplatsens utgivare",
        blocs: [
          {
            lignes: [
              "**Företagsnamn:** {raison}",
              "**Säte:** {siege}",
              "**SIRET:** {siret}",
              "**RCS:** {rcs}",
              "**Aktiekapital:** {capital}",
              "**Momsregistreringsnummer (EU):** {tva}",
              "**Telefon:** {tel}",
              "**E-post:** support@cartoonova.com",
              "**Ansvarig utgivare:** {directeur}",
            ],
          },
        ],
      },
      {
        titre: "2. Webbhotell",
        blocs: [
          {
            lignes: [
              "**Webbhotell:** Vercel Inc.",
              "**Adress:** 340 S Lemon Ave #4133, Walnut, CA 91789, USA",
              "**Webbplats:** vercel.com",
            ],
          },
        ],
      },
      {
        titre: "3. Verksamhet",
        blocs: [
          "Cartoonova är en onlinetjänst för att skapa karikatyrer och personliga porträtt i cartoonstil. Cartoonova förvandlar dina foton till unika porträtt, tillgängliga i digitalt format eller tryckta på olika material (poster, canvas, mugg osv.).",
        ],
      },
      {
        titre: "4. Immateriella rättigheter",
        blocs: [
          "Allt innehåll på Cartoonovas webbplats (texter, bilder, grafik, logotyp, ikoner, ljud, programvara osv.) skyddas av fransk och internationell lagstiftning om immateriella rättigheter.",
          "All återgivning, framställning, ändring, publicering eller bearbetning av hela eller delar av webbplatsens innehåll, oavsett medel eller metod, är förbjuden utan föregående skriftligt tillstånd från {raison}.",
          "De karikatyrer som utförs av Cartoonova förblir egendom som tillhör {raison} tills beställningen är fullt betald. Efter betalning erhåller kunden en personlig och icke-kommersiell nyttjanderätt till verket.",
        ],
      },
      {
        titre: "5. Personuppgifter",
        blocs: [
          "I enlighet med dataskyddsförordningen (GDPR) och den franska dataskyddslagen (loi « Informatique et Libertés ») av den 6 januari 1978, i dess ändrade lydelse, har du rätt till tillgång, rättelse, radering och dataportabilitet avseende dina personuppgifter.",
          "För att utöva dessa rättigheter eller för frågor om skyddet av dina uppgifter, kontakta oss på: support@cartoonova.com",
          "Mer information finns i vår [Integritetspolicy](/politique-de-confidentialite).",
        ],
      },
      {
        titre: "6. Cookies",
        blocs: [
          "Cartoonovas webbplats använder cookies för att förbättra användarupplevelsen, analysera trafiken och säkerställa att tjänsterna fungerar korrekt. Genom att fortsätta surfa godkänner du användningen av cookies i enlighet med vår integritetspolicy.",
        ],
      },
      {
        titre: "7. Ansvarsbegränsning",
        blocs: [
          "{raison} strävar efter att tillhandahålla korrekt och aktuell information på webbplatsen. Bolaget kan dock inte garantera att den publicerade informationen är korrekt, fullständig eller aktuell. {raison} frånsäger sig allt ansvar för fel eller utelämnanden i webbplatsens innehåll.",
          "Användningen av webbplatsen sker på användarens egen risk. {raison} ansvarar inte för direkta eller indirekta skador som uppstår till följd av åtkomst till eller användning av webbplatsen.",
        ],
      },
      {
        titre: "8. Tillämplig lag",
        blocs: [
          "Denna juridiska information regleras av fransk lag. Vid en tvist, och efter ett försök till uppgörelse i godo, är domstolarna i Paris ensamt behöriga.",
        ],
      },
      {
        titre: "9. Kontakt",
        blocs: ["För alla frågor kan du kontakta oss via e-post på: support@cartoonova.com"],
      },
    ],
  },

  confidentialite: {
    titre: "Integritetspolicy",
    miseAJour: "Senast uppdaterad: 21 mars 2024",
    sections: [
      {
        titre: "1. Inledning",
        blocs: [
          "Bolaget {raison} (nedan ”Cartoonova”, ”vi”, ”vår”) åtar sig att skydda sina användares och kunders (nedan ”du”, ”din”) integritet.",
          "Denna Integritetspolicy beskriver hur vi samlar in, använder, lagrar och skyddar dina personuppgifter när du använder vår webbplats **cartoonova.com** (nedan ”Webbplatsen”) och våra tjänster för att skapa personliga karikatyrer.",
          "Denna policy är förenlig med dataskyddsförordningen (GDPR — förordning (EU) 2016/679) och den franska dataskyddslagen (loi « Informatique et Libertés ») av den 6 januari 1978, i dess ändrade lydelse.",
        ],
      },
      {
        titre: "2. Personuppgiftsansvarig",
        blocs: [{ lignes: ["**{raison}**", "{siege}", "SIRET: {siret}", "E-post: support@cartoonova.com", "Tel.: {tel}"] }],
      },
      {
        titre: "3. Insamlade uppgifter",
        blocs: [
          "Inom ramen för våra tjänster kan vi komma att samla in följande kategorier av uppgifter:",
          { sousTitre: "3.1 Identifieringsuppgifter" },
          { liste: ["För- och efternamn", "E-postadress", "Postadress (för leverans av tryckta produkter)", "Telefonnummer (frivilligt)"] },
          { sousTitre: "3.2 Beställningsuppgifter" },
          {
            liste: [
              "Uppgifter om beställningen (format, alternativ, tryckmaterial)",
              "Foton som överlämnats för att skapa karikatyren",
              "Historik över beställningar och kontakter med kundtjänst",
            ],
          },
          { sousTitre: "3.3 Betalningsuppgifter" },
          {
            liste: [
              "Betalningsuppgifter (kortnummer osv.) behandlas direkt av våra säkra betalningsleverantörer (Stripe, PayPal) och lagras aldrig på våra servrar.",
            ],
          },
          { sousTitre: "3.4 Surfdata" },
          { liste: ["IP-adress", "Typ av webbläsare och operativsystem", "Besökta sidor och besökets längd", "Cookies och sessionsidentifierare"] },
        ],
      },
      {
        titre: "4. Ändamål med behandlingen",
        blocs: [
          "Dina personuppgifter samlas in och behandlas för följande ändamål:",
          {
            liste: [
              "**Fullgörande av beställningar:** framställning av karikatyren, tryck, leverans och spårning av leveransen.",
              "**Hantering av kundrelationen:** kundservice efter köp, ändringar, svar på dina förfrågningar.",
              "**Betalning:** behandling och säkring av transaktioner.",
              "**Kommunikation:** utskick av orderbekräftelser, leveransaviseringar och, med ditt samtycke, kampanjerbjudanden.",
              "**Förbättring av tjänsten:** anonymiserad statistisk analys av användningen av Webbplatsen.",
              "**Rättsliga förpliktelser:** bevarande av fakturor och bokföringsuppgifter i enlighet med gällande regler.",
            ],
          },
        ],
      },
      {
        titre: "5. Rättslig grund för behandlingen",
        blocs: [
          "Behandlingen av dina uppgifter grundar sig på följande rättsliga grunder:",
          {
            liste: [
              "**Fullgörande av avtal:** de uppgifter som krävs för att utföra och leverera din beställning.",
              "**Samtycke:** för utskick av marknadsföring och användning av icke-nödvändiga cookies.",
              "**Berättigat intresse:** för att förbättra våra tjänster och förebygga bedrägerier.",
              "**Rättslig förpliktelse:** för bevarande av bokförings- och skatteuppgifter.",
            ],
          },
        ],
      },
      {
        titre: "6. Lagringstid",
        blocs: [
          {
            liste: [
              "**Beställningsuppgifter:** 3 år efter den senaste beställningen.",
              "**Överlämnade foton:** raderas inom 90 dagar efter leverans av beställningen, om inte Kunden begär annat.",
              "**Bokföringsuppgifter:** 10 år i enlighet med rättsliga förpliktelser.",
              "**Surfcookies:** högst 13 månader.",
              "**Uppgifter för direktmarknadsföring:** 3 år efter den senaste kontakten.",
            ],
          },
        ],
      },
      {
        titre: "7. Delning av uppgifter",
        blocs: [
          "Dina personuppgifter säljs aldrig till tredje part. De kan delas med:",
          {
            liste: [
              "**Våra leverantörer för framställning:** endast de foton och instruktioner som krävs för att skapa karikatyren.",
              "**Betalningsleverantörer:** Stripe och PayPal för säker behandling av betalningar.",
              "**Tryck- och leveranstjänster:** leveransadress för att skicka tryckta produkter.",
              "**Webbhotell:** Vercel Inc. för teknisk drift av Webbplatsen.",
              "**Analysverktyg:** Google Analytics (anonymiserade uppgifter).",
            ],
          },
          "Alla våra leverantörer omfattas av strikta avtalsenliga skyldigheter avseende sekretess och dataskydd i enlighet med GDPR.",
        ],
      },
      {
        titre: "8. Internationella överföringar",
        blocs: [
          "Vissa av dina uppgifter kan överföras utanför Europeiska unionen (drift i USA via Vercel). Dessa överföringar omfattas av Europeiska kommissionens standardavtalsklausuler (SCC) eller ramverket för dataskydd mellan EU och USA (EU-U.S. Data Privacy Framework).",
        ],
      },
      {
        titre: "9. Cookies",
        blocs: [
          "Webbplatsen använder följande typer av cookies:",
          {
            liste: [
              "**Nödvändiga cookies:** krävs för att Webbplatsen ska fungera (session, varukorg, inloggning).",
              "**Analyscookies:** gör det möjligt för oss att förstå hur Webbplatsen används (Google Analytics) — kräver ditt samtycke.",
              "**Marknadsföringscookies:** används för att anpassa annonser — kräver ditt samtycke.",
            ],
          },
          "Du kan när som helst hantera dina cookieinställningar via webbläsarens inställningar eller via vår samtyckesbanner.",
        ],
      },
      {
        titre: "10. Dina rättigheter",
        blocs: [
          "I enlighet med GDPR har du följande rättigheter avseende dina personuppgifter:",
          {
            liste: [
              "**Rätt till tillgång:** få bekräftelse på att dina uppgifter behandlas och få en kopia av dem.",
              "**Rätt till rättelse:** korrigera felaktiga eller ofullständiga uppgifter.",
              "**Rätt till radering:** begära att dina uppgifter raderas (”rätten att bli bortglömd”).",
              "**Rätt till dataportabilitet:** få dina uppgifter i ett strukturerat och läsbart format.",
              "**Rätt att invända:** invända mot behandlingen av dina uppgifter av berättigade skäl.",
              "**Rätt till begränsning:** begränsa behandlingen av dina uppgifter under vissa omständigheter.",
              "**Rätt att återkalla ditt samtycke:** när som helst för behandlingar som grundar sig på samtycke.",
            ],
          },
          "För att utöva någon av dessa rättigheter, kontakta oss på: support@cartoonova.com",
          "Vi åtar oss att besvara din begäran inom 30 dagar. Du har också rätt att lämna in ett klagomål till **CNIL** (Commission Nationale de l'Informatique et des Libertés, den franska dataskyddsmyndigheten): [www.cnil.fr](https://www.cnil.fr).",
        ],
      },
      {
        titre: "11. Säkerhet",
        blocs: [
          "Vi vidtar lämpliga tekniska och organisatoriska åtgärder för att skydda dina personuppgifter mot obehörig åtkomst, förlust, förstörelse eller ändring:",
          {
            liste: [
              "SSL/TLS-kryptering av all kommunikation",
              "Begränsad åtkomst till uppgifterna enligt principen om ”behov av kännedom”",
              "Regelbundna och säkra säkerhetskopior",
              "Övervakning och loggning av åtkomst",
            ],
          },
        ],
      },
      {
        titre: "12. Minderåriga",
        blocs: [
          "Webbplatsen riktar sig inte till minderåriga under 16 år. Vi samlar inte medvetet in personuppgifter om minderåriga. Om du är förälder eller vårdnadshavare och tror att ditt barn har lämnat uppgifter till oss, kontakta oss så att vi kan radera dem.",
        ],
      },
      {
        titre: "13. Ändringar",
        blocs: [
          "Vi förbehåller oss rätten att när som helst ändra denna Integritetspolicy. Varje ändring publiceras på denna sida tillsammans med datum för uppdateringen. Vi uppmanar dig att regelbundet besöka denna sida.",
        ],
      },
      {
        titre: "14. Kontakt",
        blocs: [
          "För alla frågor om skyddet av dina personuppgifter:",
          { lignes: ["**{raison}**", "{siege}", "Tel.: {tel}", "E-post: support@cartoonova.com"] },
        ],
      },
    ],
  },
};
