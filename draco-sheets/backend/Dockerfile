FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-calc fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV DRACO_ALLOWED_ORIGINS=http://localhost:5173
EXPOSE 8000
USER nobody
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
