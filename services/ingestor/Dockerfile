# Market-data ingestor (Go). Static binary on distroless: ~15 MB image, runs as non-root.
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ingestor ./cmd/ingestor

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ingestor /ingestor
EXPOSE 8090
USER nonroot:nonroot
ENTRYPOINT ["/ingestor"]
