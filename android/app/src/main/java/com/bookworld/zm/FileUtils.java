package com.bookworld.zm;

import android.content.Context;
import android.os.AsyncTask;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class FileUtils {

    public interface DownloadCallback {
        void onDownloadComplete(File file);
        void onDownloadFailed(Exception e);
    }

    public static void downloadBook(Context context, String urlStr, String fileName, DownloadCallback callback) {
        new DownloadTask(context, fileName, callback).execute(urlStr);
    }

    private static class DownloadTask extends AsyncTask<String, Void, File> {
        private Context context;
        private String fileName;
        private DownloadCallback callback;
        private Exception exception;

        public DownloadTask(Context context, String fileName, DownloadCallback callback) {
            this.context = context;
            this.fileName = fileName;
            this.callback = callback;
        }

        @Override
        protected File doInBackground(String... params) {
            try {
                URL url = new URL(params[0]);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.connect();

                InputStream input = connection.getInputStream();
                File directory = new File(context.getFilesDir(), "downloaded_books");
                if (!directory.exists()) {
                    directory.mkdirs();
                }

                File file = new File(directory, fileName);
                FileOutputStream output = new FileOutputStream(file);

                byte[] data = new byte[4096];
                int count;
                while ((count = input.read(data)) != -1) {
                    output.write(data, 0, count);
                }

                output.close();
                input.close();
                return file;
            } catch (Exception e) {
                this.exception = e;
                return null;
            }
        }

        @Override
        protected void onPostExecute(File file) {
            if (file != null) {
                callback.onDownloadComplete(file);
            } else {
                callback.onDownloadFailed(exception);
            }
        }
    }
}
