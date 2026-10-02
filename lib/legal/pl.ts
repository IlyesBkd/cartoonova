import type { PagesLegales } from "./types";

export const LEGAL_PL: PagesLegales = {
  avertissement: "Niniejsze tłumaczenie ma charakter wyłącznie informacyjny; w przypadku rozbieżności rozstrzygająca jest wersja francuska.",
  accepterCgv: "Składając zamówienie, akceptujesz nasz [regulamin sprzedaży](/cgv).",

  cgv: {
    titre: "Regulamin Sprzedaży",
    miseAJour: "Ostatnia aktualizacja: 1 października 2026 r.",
    sections: [
      {
        titre: "Artykuł 1 — Przedmiot",
        blocs: [
          "Niniejszy Regulamin Sprzedaży (Regulamin) określa zasady sprzedaży produktów i usług przez spółkę {raison}, o kapitale zakładowym {capital}, z siedzibą pod adresem {siege}, wpisaną do francuskiego Rejestru Handlowego i Spółek (RCS) pod numerem {rcs}, zwaną dalej „Cartoonova”.",
          "Regulamin ma zastosowanie do każdego zamówienia złożonego w serwisie **cartoonova.com** (zwanym dalej „Serwisem”) przez klienta indywidualnego lub profesjonalnego (zwanego dalej „Klientem”).",
          "Złożenie zamówienia w Serwisie oznacza pełną i całkowitą akceptację niniejszego Regulaminu.",
        ],
      },
      {
        titre: "Artykuł 2 — Produkty i usługi",
        blocs: [
          "Cartoonova oferuje usługę tworzenia spersonalizowanych karykatur i portretów w stylu kreskówkowym, wykonywanych na podstawie zdjęć dostarczonych przez Klienta. Oferowane produkty obejmują:",
          {
            liste: [
              "Pliki cyfrowe (JPG, PNG w wysokiej rozdzielczości)",
              "Wydruki na plakacie",
              "Wydruki na canvasie (płótnie)",
              "Wydruki w formie portretu w ramie",
              "Wydruki na kubku",
              "Wydruki na Alu-Dibond",
            ],
          },
          "Fotografie i ilustracje prezentowane w Serwisie są możliwie najwierniejsze. Mogą jednak występować niewielkie różnice między zamówionym a otrzymanym produktem, ponieważ każda karykatura jest unikatowym dziełem wykonanym ręcznie.",
        ],
      },
      {
        titre: "Artykuł 3 — Ceny",
        blocs: [
          "Ceny podawane są w euro (€) i zawierają wszystkie podatki (brutto, z VAT). Cartoonova zastrzega sobie prawo do zmiany cen w dowolnym momencie. Produkty są fakturowane według cen obowiązujących w chwili zatwierdzenia zamówienia.",
          "Wydruki (plakat, płótno, portret w ramie) są dostarczane za zryczałtowaną opłatą za dostawę, doliczaną do ceny produktów i podawaną przed ostatecznym zatwierdzeniem zamówienia. Plik cyfrowy, wysyłany e-mailem, nie wiąże się z żadnymi kosztami dostawy.",
        ],
      },
      {
        titre: "Artykuł 4 — Zamówienie",
        blocs: [
          "Klient wybiera żądane opcje personalizacji (format, liczba osób/zwierząt, tło, nośnik wydruku) i przesyła zdjęcia niezbędne do wykonania karykatury.",
          "Zamówienie zostaje potwierdzone z chwilą zapłaty całej ceny. Na adres e-mail podany przy składaniu zamówienia Klient otrzymuje wiadomość z potwierdzeniem.",
          "Cartoonova zastrzega sobie prawo do odmowy przyjęcia lub anulowania każdego zamówienia w przypadku istniejącego sporu, nieodpowiednich zdjęć lub informacji w oczywisty sposób błędnych.",
        ],
      },
      {
        titre: "Artykuł 5 — Płatność",
        blocs: [
          "Płatności dokonuje się online kartą płatniczą (Visa, Mastercard, American Express) lub za pośrednictwem PayPal. Płatność jest zabezpieczona systemem szyfrowania SSL.",
          "Pełna kwota jest pobierana w chwili zatwierdzenia zamówienia. Żadne zamówienie nie zostanie zrealizowane przed otrzymaniem pełnej płatności.",
        ],
      },
      {
        titre: "Artykuł 6 — Terminy realizacji i dostawy",
        blocs: [
          "Czas wykonania karykatury wynosi zazwyczaj **2 dni robocze** od otrzymania płatności i zdjęć. Termin ten może się różnić w zależności od złożoności zamówienia i obciążenia pracą artystów.",
          "**Produkty cyfrowe:** Plik w wysokiej rozdzielczości jest wysyłany Klientowi e-mailem niezwłocznie po ukończeniu karykatury. Klient może następnie zażądać poprawek (artykuł 7).",
          "**Produkty drukowane:** Klientowi przedstawiany jest podgląd, który zatwierdza on przed drukiem. Druk i wysyłka trwają następnie od 3 do 7 dni roboczych w zależności od miejsca przeznaczenia. Koszty i terminy dostawy są podawane podczas składania zamówienia.",
          "**Opcja ekspresowa:** jeżeli Klient ją wybrał, karykatura jest dostarczana w ciągu 24 godzin, również w weekend, od otrzymania płatności i zdjęć. W przypadku produktu drukowanego termin ten dotyczy rysunku; druk i wysyłka następują w terminach wskazanych powyżej.",
          "Cartoonova nie ponosi odpowiedzialności za opóźnienia w dostawie spowodowane przez przewoźnika lub siłę wyższą.",
        ],
      },
      {
        titre: "Artykuł 7 — Poprawki i satysfakcja",
        blocs: [
          "Cartoonova zobowiązuje się do dostarczenia pracy wysokiej jakości, wiernej dostarczonym zdjęciom. Klientowi przysługują **bezpłatne i nieograniczone poprawki** aż do pełnej satysfakcji.",
          "Prośby o poprawki należy formułować w sposób jasny i precyzyjny e-mailem na adres support@cartoonova.com.",
          "Poprawki obejmują rozsądne korekty (podobieństwo, kolory, szczegóły). Nie obejmują całkowitej zmiany pierwotnie zatwierdzonego stylu lub kompozycji.",
          "**Gwarancja satysfakcji.** Jeżeli po poprawkach karykatura nadal nie odpowiada Klientowi, Cartoonova zwraca mu całą zapłaconą cenę na zwykłe żądanie przesłane na adres support@cartoonova.com. W przypadku produktu drukowanego żądanie należy zgłosić **przed zatwierdzeniem podglądu**: po zatwierdzeniu podglądu rozpoczyna się druk, a produkt podlega wówczas artykułowi 9.",
        ],
      },
      {
        titre: "Artykuł 8 — Prawo odstąpienia od umowy",
        blocs: [
          "Zgodnie z artykułem L221-28 francuskiego Kodeksu konsumenckiego (Code de la consommation) prawo odstąpienia od umowy **nie przysługuje** w przypadku umów o dostarczenie towarów wyprodukowanych według specyfikacji konsumenta lub wyraźnie spersonalizowanych.",
          "Ponieważ każda karykatura jest unikatowym dziełem wykonanym na zamówienie na podstawie zdjęć i instrukcji Klienta, zamówienia produktów cyfrowych nie są objęte prawem odstąpienia od umowy po rozpoczęciu prac twórczych.",
          "W przypadku produktów drukowanych, jeżeli otrzymany produkt jest uszkodzony lub niezgodny z zamówieniem, Klient może skontaktować się z obsługą klienta w terminie 14 dni od otrzymania w celu uzyskania wymiany lub zwrotu pieniędzy.",
        ],
      },
      {
        titre: "Artykuł 9 — Zwrot pieniędzy",
        blocs: [
          "Zwrot pieniędzy przysługuje w dwóch przypadkach: w ramach gwarancji satysfakcji z artykułu 7 lub gdy produkt drukowany zostanie otrzymany jako wadliwy lub niezgodny z zamówieniem. W tym drugim przypadku Cartoonova, według wyboru Klienta, dokonuje wymiany lub pełnego zwrotu pieniędzy.",
          "Zwrot jest dokonywany przy użyciu metody płatności zastosowanej przy zamówieniu, w terminie 14 dni od zatwierdzenia żądania.",
          "Żądania zwrotu należy kierować na adres support@cartoonova.com wraz z numerem zamówienia i opisem problemu.",
        ],
      },
      {
        titre: "Artykuł 9 bis — Bony podarunkowe",
        blocs: [
          "Cartoonova oferuje bony podarunkowe o stałej wartości, opłacane online i przekazywane e-mailem w formie kodu oraz wersji do wydruku.",
          "Bon jest ważny przez **12 miesięcy** od daty zakupu, w walucie zakupu. Może być wykorzystany w ramach jednego lub kilku zamówień, aż do wyczerpania salda. Każde zamówienie obejmuje kwotę minimalną 1 (w walucie zamówienia) pozostającą do zapłaty przez Klienta; niewykorzystane saldo pozostaje dostępne.",
          "Bon nie podlega zwrotowi ani wymianie na gotówkę. Czternastodniowe prawo odstąpienia od umowy ma zastosowanie do zakupu bonu, dopóki nie został on wykorzystany: w takim przypadku zwrotu można zażądać pod adresem support@cartoonova.com.",
        ],
      },
      {
        titre: "Artykuł 10 — Własność intelektualna",
        blocs: [
          "Karykatury tworzone przez Cartoonova są oryginalnymi utworami chronionymi prawem autorskim. Po zapłacie całej ceny Klient otrzymuje **prawo do osobistego i niekomercyjnego korzystania** z utworu.",
          "Cartoonova zastrzega sobie prawo do wykorzystywania wykonanych karykatur w celach promocyjnych (portfolio, media społecznościowe), chyba że Klient wyraźnie zażąda inaczej.",
        ],
      },
      {
        titre: "Artykuł 11 — Odpowiedzialność",
        blocs: [
          "Cartoonova nie ponosi odpowiedzialności za sposób wykorzystania dostarczonych karykatur przez Klienta. Klient gwarantuje, że posiada niezbędne prawa do przesłanych zdjęć i nie wykorzystuje ich w celach zniesławiających lub niezgodnych z prawem.",
        ],
      },
      {
        titre: "Artykuł 12 — Ochrona danych",
        blocs: [
          "Dane osobowe zbierane w związku z zamówieniami są przetwarzane zgodnie z naszą [Polityką Prywatności](/politique-de-confidentialite).",
          "Zdjęcia przesłane przez Klienta są wykorzystywane wyłącznie do realizacji zamówienia i są usuwane w terminie 90 dni od dostawy, chyba że Klient zażąda ich przechowania.",
        ],
      },
      {
        titre: "Artykuł 13 — Mediacja i spory",
        blocs: [
          "W przypadku sporu Klient proszony jest o skontaktowanie się w pierwszej kolejności z obsługą klienta Cartoonova pod adresem support@cartoonova.com w celu znalezienia polubownego rozwiązania.",
          "Zgodnie z artykułami L611-1 i następnymi francuskiego Kodeksu konsumenckiego (Code de la consommation) Klient może bezpłatnie skorzystać z pomocy mediatora konsumenckiego w celu polubownego rozwiązania sporu.",
          "W braku polubownego rozwiązania wyłączną właściwość mają sądy w Paryżu. Niniejszy Regulamin podlega prawu francuskiemu.",
        ],
      },
      {
        titre: "Artykuł 14 — Kontakt",
        blocs: [
          "W przypadku pytań dotyczących zamówienia lub niniejszego Regulaminu:",
          { lignes: ["**{raison}**", "{siege}", "Tel.: {tel}", "E-mail: support@cartoonova.com"] },
        ],
      },
    ],
  },

  mentions: {
    titre: "Nota Prawna",
    miseAJour: "Ostatnia aktualizacja: 21 marca 2024 r.",
    sections: [
      {
        titre: "1. Wydawca serwisu",
        blocs: [
          {
            lignes: [
              "**Firma:** {raison}",
              "**Siedziba:** {siege}",
              "**SIRET:** {siret}",
              "**RCS:** {rcs}",
              "**Kapitał zakładowy:** {capital}",
              "**Numer VAT UE:** {tva}",
              "**Telefon:** {tel}",
              "**E-mail:** support@cartoonova.com",
              "**Dyrektor ds. publikacji:** {directeur}",
            ],
          },
        ],
      },
      {
        titre: "2. Hosting",
        blocs: [
          {
            lignes: [
              "**Dostawca hostingu:** Vercel Inc.",
              "**Adres:** 340 S Lemon Ave #4133, Walnut, CA 91789, Stany Zjednoczone",
              "**Strona internetowa:** vercel.com",
            ],
          },
        ],
      },
      {
        titre: "3. Działalność",
        blocs: [
          "Cartoonova jest serwisem internetowym zajmującym się tworzeniem spersonalizowanych karykatur i portretów w stylu kreskówkowym. Cartoonova przekształca Państwa zdjęcia w unikatowe portrety, dostępne w formacie cyfrowym lub drukowane na różnych nośnikach (plakat, canvas, kubek itp.).",
        ],
      },
      {
        titre: "4. Własność intelektualna",
        blocs: [
          "Wszelkie treści serwisu Cartoonova (teksty, obrazy, grafika, logo, ikony, dźwięki, oprogramowanie itp.) są chronione przez francuskie i międzynarodowe przepisy dotyczące własności intelektualnej.",
          "Wszelkie powielanie, przedstawianie, modyfikowanie, publikowanie lub adaptowanie całości lub części elementów serwisu, bez względu na zastosowany środek lub sposób, jest zabronione bez uprzedniej pisemnej zgody {raison}.",
          "Karykatury wykonane przez Cartoonova pozostają własnością {raison} do czasu zapłaty całej kwoty zamówienia. Po dokonaniu płatności klient otrzymuje prawo do osobistego i niekomercyjnego korzystania z utworu.",
        ],
      },
      {
        titre: "5. Dane osobowe",
        blocs: [
          "Zgodnie z Ogólnym rozporządzeniem o ochronie danych (RODO) oraz francuską ustawą o ochronie danych (loi „Informatique et Libertés”) z dnia 6 stycznia 1978 r. z późniejszymi zmianami przysługuje Państwu prawo dostępu do swoich danych osobowych, ich sprostowania, usunięcia oraz przenoszenia.",
          "W celu wykonania tych praw lub w przypadku pytań dotyczących ochrony danych prosimy o kontakt pod adresem: support@cartoonova.com",
          "Więcej informacji znajdą Państwo w naszej [Polityce Prywatności](/politique-de-confidentialite).",
        ],
      },
      {
        titre: "6. Pliki cookie",
        blocs: [
          "Serwis Cartoonova wykorzystuje pliki cookie w celu poprawy komfortu użytkowania, analizy ruchu oraz zapewnienia prawidłowego działania usług. Kontynuując przeglądanie, akceptują Państwo wykorzystywanie plików cookie zgodnie z naszą polityką prywatności.",
        ],
      },
      {
        titre: "7. Ograniczenie odpowiedzialności",
        blocs: [
          "{raison} dokłada starań, aby informacje zamieszczane w serwisie były dokładne i aktualne. Nie może jednak zagwarantować dokładności, kompletności ani aktualności rozpowszechnianych informacji. {raison} nie ponosi żadnej odpowiedzialności za błędy lub pominięcia w treści serwisu.",
          "Użytkownik korzysta z serwisu na własne ryzyko. {raison} nie ponosi odpowiedzialności za szkody bezpośrednie lub pośrednie wynikające z dostępu do serwisu lub korzystania z niego.",
        ],
      },
      {
        titre: "8. Prawo właściwe",
        blocs: [
          "Niniejsza nota prawna podlega prawu francuskiemu. W przypadku sporu, po próbie polubownego rozwiązania, wyłączną właściwość mają sądy w Paryżu.",
        ],
      },
      {
        titre: "9. Kontakt",
        blocs: ["W przypadku jakichkolwiek pytań prosimy o kontakt e-mailowy pod adresem: support@cartoonova.com"],
      },
    ],
  },

  confidentialite: {
    titre: "Polityka Prywatności",
    miseAJour: "Ostatnia aktualizacja: 21 marca 2024 r.",
    sections: [
      {
        titre: "1. Wprowadzenie",
        blocs: [
          "Spółka {raison} (zwana dalej „Cartoonova”, „my”, „nasz”) zobowiązuje się chronić prywatność swoich użytkowników i klientów (zwanych dalej „Państwem”).",
          "Niniejsza Polityka Prywatności opisuje, w jaki sposób zbieramy, wykorzystujemy, przechowujemy i chronimy Państwa dane osobowe, gdy korzystają Państwo z naszego serwisu **cartoonova.com** (zwanego dalej „Serwisem”) oraz z naszych usług tworzenia spersonalizowanych karykatur.",
          "Niniejsza polityka jest zgodna z Ogólnym rozporządzeniem o ochronie danych (RODO — Rozporządzenie UE 2016/679) oraz francuską ustawą o ochronie danych (loi „Informatique et Libertés”) z dnia 6 stycznia 1978 r. z późniejszymi zmianami.",
        ],
      },
      {
        titre: "2. Administrator danych",
        blocs: [{ lignes: ["**{raison}**", "{siege}", "SIRET: {siret}", "E-mail: support@cartoonova.com", "Tel.: {tel}"] }],
      },
      {
        titre: "3. Zbierane dane",
        blocs: [
          "W ramach świadczenia naszych usług zbieramy następujące kategorie danych:",
          { sousTitre: "3.1 Dane identyfikacyjne" },
          { liste: ["Imię i nazwisko", "Adres e-mail", "Adres pocztowy (w przypadku dostawy produktów drukowanych)", "Numer telefonu (opcjonalnie)"] },
          { sousTitre: "3.2 Dane dotyczące zamówienia" },
          {
            liste: [
              "Szczegóły zamówienia (format, opcje, nośnik wydruku)",
              "Zdjęcia przesłane w celu wykonania karykatury",
              "Historia zamówień i korespondencji z obsługą klienta",
            ],
          },
          { sousTitre: "3.3 Dane dotyczące płatności" },
          {
            liste: [
              "Dane dotyczące płatności (numer karty itp.) są przetwarzane bezpośrednio przez naszych bezpiecznych dostawców usług płatniczych (Stripe, PayPal) i nigdy nie są przechowywane na naszych serwerach.",
            ],
          },
          { sousTitre: "3.4 Dane dotyczące przeglądania" },
          { liste: ["Adres IP", "Rodzaj przeglądarki i system operacyjny", "Odwiedzone strony i czas trwania wizyty", "Pliki cookie i identyfikatory sesji"] },
        ],
      },
      {
        titre: "4. Cele przetwarzania",
        blocs: [
          "Państwa dane osobowe są zbierane i przetwarzane w następujących celach:",
          {
            liste: [
              "**Realizacja zamówień:** wykonanie karykatury, druk, wysyłka i śledzenie dostawy.",
              "**Zarządzanie relacjami z klientami:** obsługa posprzedażowa, poprawki, odpowiedzi na Państwa zapytania.",
              "**Płatność:** przetwarzanie i zabezpieczanie transakcji.",
              "**Komunikacja:** wysyłanie potwierdzeń zamówień, powiadomień o dostawie oraz, za Państwa zgodą, ofert promocyjnych.",
              "**Doskonalenie usługi:** zanonimizowana analiza statystyczna korzystania z Serwisu.",
              "**Obowiązki prawne:** przechowywanie faktur i danych księgowych zgodnie z obowiązującymi przepisami.",
            ],
          },
        ],
      },
      {
        titre: "5. Podstawa prawna przetwarzania",
        blocs: [
          "Przetwarzanie Państwa danych opiera się na następujących podstawach prawnych:",
          {
            liste: [
              "**Wykonanie umowy:** dane niezbędne do realizacji i dostawy Państwa zamówienia.",
              "**Zgoda:** w odniesieniu do wysyłania komunikatów marketingowych i wykorzystywania nieniezbędnych plików cookie.",
              "**Prawnie uzasadniony interes:** w odniesieniu do doskonalenia naszych usług i zapobiegania oszustwom.",
              "**Obowiązek prawny:** w odniesieniu do przechowywania danych księgowych i podatkowych.",
            ],
          },
        ],
      },
      {
        titre: "6. Okres przechowywania",
        blocs: [
          {
            liste: [
              "**Dane dotyczące zamówień:** 3 lata od ostatniego zamówienia.",
              "**Przesłane zdjęcia:** usuwane w terminie 90 dni od dostawy zamówienia, chyba że Klient zażąda inaczej.",
              "**Dane księgowe:** 10 lat zgodnie z obowiązkami prawnymi.",
              "**Pliki cookie dotyczące przeglądania:** maksymalnie 13 miesięcy.",
              "**Dane marketingowe (pozyskiwanie klientów):** 3 lata od ostatniego kontaktu.",
            ],
          },
        ],
      },
      {
        titre: "7. Udostępnianie danych",
        blocs: [
          "Państwa dane osobowe nigdy nie są sprzedawane osobom trzecim. Mogą być udostępniane:",
          {
            liste: [
              "**Naszym wykonawcom:** wyłącznie zdjęcia i instrukcje niezbędne do wykonania karykatury.",
              "**Dostawcom usług płatniczych:** Stripe i PayPal w celu bezpiecznego przetwarzania płatności.",
              "**Usługodawcom drukarskim i kurierskim:** adres dostawy w celu wysyłki produktów drukowanych.",
              "**Dostawcy hostingu:** Vercel Inc. w celu technicznego hostingu Serwisu.",
              "**Narzędziom analitycznym:** Google Analytics (dane zanonimizowane).",
            ],
          },
          "Wszyscy nasi usługodawcy podlegają ścisłym umownym obowiązkom zachowania poufności i ochrony danych zgodnym z RODO.",
        ],
      },
      {
        titre: "8. Przekazywanie danych za granicę",
        blocs: [
          "Niektóre z Państwa danych mogą być przekazywane poza Unię Europejską (hosting w Stanach Zjednoczonych za pośrednictwem Vercel). Przekazywanie to odbywa się na podstawie Standardowych Klauzul Umownych (SKU) Komisji Europejskiej lub Ramowych zasad ochrony prywatności danych UE-USA (Data Privacy Framework).",
        ],
      },
      {
        titre: "9. Pliki cookie",
        blocs: [
          "Serwis wykorzystuje następujące rodzaje plików cookie:",
          {
            liste: [
              "**Niezbędne pliki cookie:** konieczne do działania Serwisu (sesja, koszyk, uwierzytelnianie).",
              "**Analityczne pliki cookie:** pozwalają nam zrozumieć, w jaki sposób Serwis jest używany (Google Analytics) — wymagają Państwa zgody.",
              "**Marketingowe pliki cookie:** wykorzystywane do personalizacji reklam — wymagają Państwa zgody.",
            ],
          },
          "Mogą Państwo w każdej chwili zarządzać swoimi preferencjami dotyczącymi plików cookie za pomocą ustawień przeglądarki lub naszego banera zgody.",
        ],
      },
      {
        titre: "10. Państwa prawa",
        blocs: [
          "Zgodnie z RODO przysługują Państwu następujące prawa w odniesieniu do Państwa danych osobowych:",
          {
            liste: [
              "**Prawo dostępu:** uzyskanie potwierdzenia, że Państwa dane są przetwarzane, oraz uzyskanie ich kopii.",
              "**Prawo do sprostowania:** poprawienie danych nieprawidłowych lub niekompletnych.",
              "**Prawo do usunięcia danych:** żądanie usunięcia Państwa danych („prawo do bycia zapomnianym”).",
              "**Prawo do przenoszenia danych:** otrzymanie Państwa danych w ustrukturyzowanym i czytelnym formacie.",
              "**Prawo do sprzeciwu:** wniesienie sprzeciwu wobec przetwarzania Państwa danych z uzasadnionych przyczyn.",
              "**Prawo do ograniczenia przetwarzania:** ograniczenie przetwarzania Państwa danych w określonych okolicznościach.",
              "**Prawo do wycofania zgody:** w dowolnym momencie w odniesieniu do przetwarzania opartego na zgodzie.",
            ],
          },
          "W celu wykonania któregokolwiek z tych praw prosimy o kontakt pod adresem: support@cartoonova.com",
          "Zobowiązujemy się odpowiedzieć na Państwa żądanie w terminie 30 dni. Przysługuje Państwu również prawo do wniesienia skargi do **CNIL** (Commission Nationale de l'Informatique et des Libertés, francuskiego organu ochrony danych): [www.cnil.fr](https://www.cnil.fr).",
        ],
      },
      {
        titre: "11. Bezpieczeństwo",
        blocs: [
          "Stosujemy odpowiednie środki techniczne i organizacyjne w celu ochrony Państwa danych osobowych przed nieuprawnionym dostępem, utratą, zniszczeniem lub zmianą:",
          {
            liste: [
              "Szyfrowanie SSL/TLS całej komunikacji",
              "Ograniczony dostęp do danych na zasadzie „niezbędnej wiedzy”",
              "Regularne i zabezpieczone kopie zapasowe",
              "Monitorowanie i rejestrowanie dostępu",
            ],
          },
        ],
      },
      {
        titre: "12. Osoby niepełnoletnie",
        blocs: [
          "Serwis nie jest przeznaczony dla osób niepełnoletnich poniżej 16. roku życia. Nie zbieramy świadomie danych osobowych osób niepełnoletnich. Jeżeli są Państwo rodzicem lub opiekunem i uważają Państwo, że Państwa dziecko przekazało nam dane, prosimy o kontakt, abyśmy mogli je usunąć.",
        ],
      },
      {
        titre: "13. Zmiany",
        blocs: [
          "Zastrzegamy sobie prawo do zmiany niniejszej Polityki Prywatności w dowolnym momencie. Każda zmiana zostanie opublikowana na tej stronie wraz z datą aktualizacji. Zachęcamy do regularnego zapoznawania się z treścią tej strony.",
        ],
      },
      {
        titre: "14. Kontakt",
        blocs: [
          "W przypadku pytań dotyczących ochrony Państwa danych osobowych:",
          { lignes: ["**{raison}**", "{siege}", "Tel.: {tel}", "E-mail: support@cartoonova.com"] },
        ],
      },
    ],
  },
};
