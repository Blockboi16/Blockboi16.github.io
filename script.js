
document.addEventListener("DOMContentLoaded", function () {

    // =====================================
    // 1. CONNECT TO SUPABASE
    // =====================================

    const SUPABASE_URL = "https://pduyjliihqqqoyaigwjr.supabase.co";
    const SUPABASE_KEY = "sb_publishable_iLqhEnOB6gGLmliThJkYsQ_ftNXTuvF";

    const supabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    // =====================================
    // 2. WEBSITE ELEMENTS
    // =====================================

    const addBookBtn = document.getElementById("addBookBtn");
    const bookForm = document.getElementById("bookForm");
    const saveBookBtn = document.getElementById("saveBookBtn");
    const bookList = document.getElementById("bookList");
    const tbrCount = document.getElementById("tbrCount");

    const loginSection = document.getElementById("loginSection");
    const adminSection = document.getElementById("adminSection");
    const adminEmail = document.getElementById("adminEmail");
    const adminPassword = document.getElementById("adminPassword");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const loginMessage = document.getElementById("loginMessage");

    let books = [];
    let isAdmin = false;
    let editingIndex = null;
    let detailsBookIndex = null;

    let currentRating = 0;
    let currentSpiceRating = 0;

    // =====================================
    // 3. BOOK DETAILS WINDOW
    // =====================================

    const detailsModal = document.createElement("div");
    detailsModal.classList.add("details-modal");
    detailsModal.style.display = "none";

    detailsModal.innerHTML = `
        <div class="details-panel">

            <button class="close-details" type="button"
                aria-label="Close">&times;</button>

            <h2 class="details-title">Book Details</h2>

            <div class="details-content">

                <label class="read-toggle">
                    <input type="checkbox" id="isRead">
                    <span>I've read this book</span>
                </label>

                <div class="rating-section">
                    <label>⭐ My Star Rating</label>
                    <div id="starRating" class="rating-buttons"></div>
                </div>

                <div class="rating-section">
                    <label>🌶️ Spice Rating</label>
                    <div id="spiceRating" class="rating-buttons"></div>
                </div>

                <label for="bookLink">🔗 Book Link</label>
                <input type="url" id="bookLink"
                    placeholder="https://example.com">

                <label for="bookBlurb">📖 Book Blurb</label>
                <textarea id="bookBlurb"
                    placeholder="Add the book description or synopsis here..."
                    rows="7"></textarea>

                <button id="saveDetailsBtn" type="button">
                    Save Details
                </button>

            </div>
        </div>
    `;

    document.body.appendChild(detailsModal);

    const closeDetailsBtn = detailsModal.querySelector(".close-details");
    const detailsTitle = detailsModal.querySelector(".details-title");
    const bookLinkInput = detailsModal.querySelector("#bookLink");
    const bookBlurbInput = detailsModal.querySelector("#bookBlurb");
    const saveDetailsBtn = detailsModal.querySelector("#saveDetailsBtn");
    const isReadInput = detailsModal.querySelector("#isRead");

    const starRatingContainer = detailsModal.querySelector("#starRating");
    const spiceRatingContainer = detailsModal.querySelector("#spiceRating");

    // =====================================
    // 4. RATINGS
    // =====================================

    function createRatingButtons(container, type) {

        container.innerHTML = "";

        for (let i = 1; i <= 5; i++) {

            const button = document.createElement("button");
            button.type = "button";
            button.classList.add("rating-button");
            button.setAttribute("aria-label", "Rate " + i + " out of 5");

            button.textContent = type === "star" ? "☆" : "🌶️";

            button.addEventListener("click", function () {

                if (!isAdmin) return;

                if (type === "star") {
                    currentRating = i;
                } else {
                    currentSpiceRating = i;
                }

                updateRatingButtons(container, type);
            });

            container.appendChild(button);
        }

        updateRatingButtons(container, type);
    }

    function updateRatingButtons(container, type) {

        const rating = type === "star"
            ? currentRating
            : currentSpiceRating;

        container.querySelectorAll(".rating-button")
            .forEach(function (button, index) {

                button.classList.toggle("selected", index < rating);

                if (type === "star") {
                    button.textContent = index < rating ? "★" : "☆";
                }
            });
    }

    createRatingButtons(starRatingContainer, "star");
    createRatingButtons(spiceRatingContainer, "spice");

    // =====================================
    // 5. BOOK DATA CONVERSION
    // =====================================

    // Supabase uses underscores in column names.
    // This converts them into the names used by our website.

    function fromDatabase(book) {
        return {
            id: book.id,
            title: book.title,
            author: book.author || "",
            series: book.series || "",
            seriesNumber: book.series_number || "",
            price: book.price ?? "",
            cover: book.cover || "",
            link: book.link || "",
            blurb: book.blurb || "",
            isRead: book.is_read || false,
            rating: book.rating || 0,
            spiceRating: book.spice_rating || 0
        };
    }

    function toDatabase(book) {
        return {
            title: book.title,
            author: book.author,
            series: book.series || null,
            series_number: book.seriesNumber || null,
            price: book.price === "" ? null : Number(book.price),
            cover: book.cover || null,
            link: book.link || null,
            blurb: book.blurb || null,
            is_read: book.isRead || false,
            rating: book.rating || 0,
            spice_rating: book.spiceRating || 0
        };
    }

    // =====================================
    // 6. LOAD BOOKS FROM SUPABASE
    // =====================================

    async function loadBooks() {

        bookList.innerHTML = "<p>Loading your bookshelf...</p>";

        const { data, error } = await supabase
            .from("books")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            console.error(error);
            bookList.innerHTML =
                "<p>Sorry, we couldn't load the bookshelf. Please try again later.</p>";
            return;
        }

        books = data.map(fromDatabase);
        displayBooks();
    }

    // =====================================
    // 7. TRANSFER EXISTING LOCAL BOOKS
    // =====================================

    async function importOldBooks() {

        if (localStorage.getItem("booksImportedToSupabase") === "true") {
            return;
        }

        let oldBooks = [];

        try {
            oldBooks = JSON.parse(localStorage.getItem("myBooks")) || [];
        } catch (error) {
            console.error("Could not read old books:", error);
            return;
        }

        if (!Array.isArray(oldBooks) || oldBooks.length === 0) {
            return;
        }

        const { count, error: countError } = await supabase
            .from("books")
            .select("*", { count: "exact", head: true });

        if (countError) {
            console.error("Could not check existing books:", countError);
            alert("We couldn't check your online library. Your old books have not been imported.");
            return;
        }

        if (count > 0) {
            alert("Your online library already contains books. Automatic import was skipped to avoid duplicates.");
            return;
        }

        const oldBooksForDatabase = oldBooks.map(toDatabase);

        const { error } = await supabase
            .from("books")
            .insert(oldBooksForDatabase);

        if (error) {
            console.error("Import error:", error);
            alert("We couldn't transfer your old books. Your browser copy has been kept safe.");
            return;
        }

        localStorage.setItem("booksImportedToSupabase", "true");

        alert("Your existing books have been transferred to your online library! 📚");
    }

    // =====================================
    // 8. LOGIN AND LOGOUT
    // =====================================

    async function updateLoginDisplay() {

        const { data } = await supabase.auth.getSession();

        const user = data.session?.user;

        // Your database policies are the real security.
        // This check controls which buttons appear on the page.

        const ownerId = "d0987a27-b398-4ab8-aec6-9b5b9628f93b";

        isAdmin = Boolean(user && user.id === ownerId);

        loginSection.style.display = isAdmin ? "none" : "block";
        adminSection.style.display = isAdmin ? "block" : "none";

        addBookBtn.style.display = isAdmin ? "inline-block" : "none";

        if (!isAdmin) {
            bookForm.style.display = "none";
            editingIndex = null;
        }

        await loadBooks();

        if (isAdmin) {
            await importOldBooks();
            await loadBooks();
        }
    }

    loginBtn.addEventListener("click", async function () {

        const email = adminEmail.value.trim();
        const password = adminPassword.value;

        if (!email || !password) {
            loginMessage.textContent = "Please enter your email and password.";
            return;
        }

        loginBtn.disabled = true;
        loginMessage.textContent = "Logging in...";

        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        loginBtn.disabled = false;

        if (error) {
            loginMessage.textContent = error.message;
            return;
        }

        adminPassword.value = "";
        loginMessage.textContent = "Welcome back! 💗";

        await updateLoginDisplay();
    });

    logoutBtn.addEventListener("click", async function () {

        const { error } = await supabase.auth.signOut();

        if (error) {
            alert("Could not log out: " + error.message);
            return;
        }

        closeDetails();
        await updateLoginDisplay();
    });

    // =====================================
    // 9. SHOW OR HIDE THE ADD BOOK FORM
    // =====================================

    addBookBtn.addEventListener("click", function () {

        if (!isAdmin) return;

        if (bookForm.style.display === "none") {
            bookForm.style.display = "block";
        } else {
            bookForm.style.display = "none";
        }

        if (editingIndex === null) {
            clearForm();
        }
    });

    function clearForm() {

        document.getElementById("title").value = "";
        document.getElementById("author").value = "";
        document.getElementById("series").value = "";
        document.getElementById("seriesNumber").value = "";
        document.getElementById("price").value = "";
        document.getElementById("cover").value = "";

        editingIndex = null;
        saveBookBtn.textContent = "Add Book to My Library";
    }

    // =====================================
    // 10. ADD OR EDIT A BOOK
    // =====================================

    saveBookBtn.addEventListener("click", async function () {

        if (!isAdmin) return;

        const title = document.getElementById("title").value.trim();
        const author = document.getElementById("author").value.trim();
        const series = document.getElementById("series").value.trim();
        const seriesNumber = document.getElementById("seriesNumber").value;
        const price = document.getElementById("price").value;
        const cover = document.getElementById("cover").value.trim();

        if (!title || !author) {
            alert("Please enter a book title and author!");
            return;
        }

        if (price !== "" && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
            alert("Please enter a valid price.");
            return;
        }

        const existingBook = editingIndex !== null
            ? books[editingIndex]
            : {};

        const book = {
            title: title,
            author: author,
            series: series,
            seriesNumber: seriesNumber,
            price: price,
            cover: cover,
            link: existingBook.link || "",
            blurb: existingBook.blurb || "",
            isRead: existingBook.isRead || false,
            rating: existingBook.rating || 0,
            spiceRating: existingBook.spiceRating || 0
        };

        saveBookBtn.disabled = true;
        saveBookBtn.textContent = "Saving...";

        let result;

        if (editingIndex !== null) {

            result = await supabase
                .from("books")
                .update(toDatabase(book))
                .eq("id", existingBook.id);

        } else {

            result = await supabase
                .from("books")
                .insert(toDatabase(book));
        }

        saveBookBtn.disabled = false;
        saveBookBtn.textContent = editingIndex !== null
            ? "Save Changes"
            : "Add Book to My Library";

        if (result.error) {
            console.error(result.error);
            alert("We couldn't save your book: " + result.error.message);
            return;
        }

        clearForm();
        bookForm.style.display = "none";

        await loadBooks();
    });

    // =====================================
    // 11. DISPLAY THE BOOKSHELF
    // =====================================

    function displayBooks() {

        bookList.innerHTML = "";

        books.forEach(function (book, index) {

            const bookCard = document.createElement("div");
            bookCard.classList.add("book-card");

            const heading = document.createElement("h3");
            heading.classList.add("clickable-title");
            heading.textContent = book.title;

            heading.addEventListener("click", function () {
                openDetails(index);
            });

            if (book.isRead) {

                const readSymbol = document.createElement("span");
                readSymbol.classList.add("read-symbol");
                readSymbol.textContent = "✓";
                readSymbol.title = "Read";

                heading.appendChild(document.createTextNode(" "));
                heading.appendChild(readSymbol);
            }

            bookCard.appendChild(heading);

            if (book.rating > 0) {

                const rating = document.createElement("p");
                rating.classList.add("card-rating");
                rating.textContent = "⭐".repeat(book.rating);

                bookCard.appendChild(rating);
            }

            if (book.spiceRating > 0) {

                const spice = document.createElement("p");
                spice.classList.add("card-spice");
                spice.textContent = "🌶️".repeat(book.spiceRating);

                bookCard.appendChild(spice);
            }

            const author = document.createElement("p");
            author.textContent = "By " + book.author;
            bookCard.appendChild(author);

            const series = document.createElement("p");
            series.textContent = "Series: " + (book.series || "Standalone");
            bookCard.appendChild(series);

            const number = document.createElement("p");
            number.textContent = "Book number: " + (book.seriesNumber || "N/A");
            bookCard.appendChild(number);

            const price = document.createElement("p");
            price.textContent = "Price: " +
                (book.price !== "" && book.price !== null
                    ? "£" + Number(book.price).toFixed(2)
                    : "N/A");

            bookCard.appendChild(price);

            if (isAdmin) {

                const editBtn = document.createElement("button");
                editBtn.textContent = "✏️ Edit";
                editBtn.classList.add("edit-btn");

                editBtn.addEventListener("click", function () {
                    editBook(index);
                });

                bookCard.appendChild(editBtn);

                const deleteBtn = document.createElement("button");
                deleteBtn.textContent = "🗑️ Delete";
                deleteBtn.classList.add("delete-btn");

                deleteBtn.addEventListener("click", function () {
                    deleteBook(index);
                });

                bookCard.appendChild(deleteBtn);
            }

            bookList.appendChild(bookCard);
        });

        tbrCount.textContent = books.length;
    }

    // =====================================
    // 12. BOOK DETAILS
    // =====================================

    function openDetails(index) {

        const book = books[index];

        detailsBookIndex = index;
        detailsTitle.textContent = book.title;

        bookLinkInput.value = book.link || "";
        bookBlurbInput.value = book.blurb || "";
        isReadInput.checked = book.isRead || false;

        currentRating = book.rating || 0;
        currentSpiceRating = book.spiceRating || 0;

        // Visitors can view details but cannot change them.

        bookLinkInput.disabled = !isAdmin;
        bookBlurbInput.disabled = !isAdmin;
        isReadInput.disabled = !isAdmin;

        saveDetailsBtn.style.display = isAdmin ? "inline-block" : "none";

        updateRatingButtons(starRatingContainer, "star");
        updateRatingButtons(spiceRatingContainer, "spice");

        detailsModal.style.display = "flex";
    }

    function closeDetails() {
        detailsModal.style.display = "none";
        detailsBookIndex = null;
    }

    closeDetailsBtn.addEventListener("click", closeDetails);

    detailsModal.addEventListener("click", function (event) {

        if (event.target === detailsModal) {
            closeDetails();
        }
    });

    saveDetailsBtn.addEventListener("click", async function () {

        if (!isAdmin || detailsBookIndex === null) return;

        const book = books[detailsBookIndex];

        const updatedBook = {
            ...book,
            link: bookLinkInput.value.trim(),
            blurb: bookBlurbInput.value.trim(),
            isRead: isReadInput.checked,
            rating: currentRating,
            spiceRating: currentSpiceRating
        };

        saveDetailsBtn.disabled = true;
        saveDetailsBtn.textContent = "Saving...";

        const { error } = await supabase
            .from("books")
            .update(toDatabase(updatedBook))
            .eq("id", book.id);

        saveDetailsBtn.disabled = false;
        saveDetailsBtn.textContent = "Save Details";

        if (error) {
            console.error(error);
            alert("We couldn't save the details: " + error.message);
            return;
        }

        closeDetails();
        await loadBooks();
    });

    // =====================================
    // 13. EDIT A BOOK
    // =====================================

    function editBook(index) {

        if (!isAdmin) return;

        const book = books[index];

        document.getElementById("title").value = book.title;
        document.getElementById("author").value = book.author;
        document.getElementById("series").value = book.series;
        document.getElementById("seriesNumber").value = book.seriesNumber;
        document.getElementById("price").value = book.price;
        document.getElementById("cover").value = book.cover;

        editingIndex = index;

        saveBookBtn.textContent = "Save Changes";
        bookForm.style.display = "block";

        bookForm.scrollIntoView({
            behavior: "smooth"
        });
    }

    // =====================================
    // 14. DELETE A BOOK
    // =====================================

    async function deleteBook(index) {

        if (!isAdmin) return;

        const book = books[index];

        const confirmDelete = confirm(
            "Are you sure you want to delete " + book.title + "?"
        );

        if (!confirmDelete) return;

        const { error } = await supabase
            .from("books")
            .delete()
            .eq("id", book.id);

        if (error) {
            console.error(error);
            alert("We couldn't delete this book: " + error.message);
            return;
        }

        await loadBooks();
    }

    // =====================================
    // 15. START THE WEBSITE
    // =====================================

    updateLoginDisplay();
});
