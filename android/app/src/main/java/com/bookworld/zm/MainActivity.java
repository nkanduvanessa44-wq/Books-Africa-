package com.bookworld.zm;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private BookAdapter adapter;
    private List<Book> bookList;
    private FirebaseFirestore db;
    private FloatingActionButton uploadFab, offlineFab;
    private String userRole;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        db = FirebaseFirestore.getInstance();
        userRole = getIntent().getStringExtra("role");

        recyclerView = findViewById(R.id.recyclerView);
        recyclerView.setLayoutManager(new GridLayoutManager(this, 2));
        bookList = new ArrayList<>();
        adapter = new BookAdapter(this, bookList);
        recyclerView.setAdapter(adapter);

        uploadFab = findViewById(R.id.fab_upload);
        offlineFab = findViewById(R.id.fab_offline);

        if ("writer".equals(userRole)) {
            uploadFab.setVisibility(View.VISIBLE);
        } else {
            uploadFab.setVisibility(View.GONE);
        }

        uploadFab.setOnClickListener(v -> startActivity(new Intent(MainActivity.this, UploadActivity.class)));
        offlineFab.setOnClickListener(v -> startActivity(new Intent(MainActivity.this, OfflineBooksActivity.class)));

        loadBooks();
    }

    private void loadBooks() {
        db.collection("books").get()
            .addOnCompleteListener(task -> {
                if (task.isSuccessful()) {
                    bookList.clear();
                    for (QueryDocumentSnapshot document : task.getResult()) {
                        Book book = document.toObject(Book.class);
                        book.setId(document.getId());
                        bookList.add(book);
                    }
                    adapter.notifyDataSetChanged();
                } else {
                    Toast.makeText(MainActivity.this, "Error loading books", Toast.LENGTH_SHORT).show();
                }
            });
    }
}
