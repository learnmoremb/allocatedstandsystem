# ---- Stand price model (Python / FastAPI) ----
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./
COPY data ./data
# generate the synthetic data and train the model at build time, so the image ships ready to serve
RUN mkdir -p model && python generate_data.py && python train.py \
    && useradd --system --no-create-home pricing && chown -R pricing /app
USER pricing

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
