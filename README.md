# Songwriter Explorer

好きな曲を入力すると、その曲の作詞・作曲者と、その人が手がけた他の作品を調べられる Web アプリです。データはオープンな音楽百科事典 [MusicBrainz](https://musicbrainz.org/) の API から取得します（API キー不要・無料）。

## 機能

- **曲名検索**: 曲名で録音（recording）を検索
- **アーティスト名で絞り込み**: 同名曲が多い場合もアーティスト名を併用して候補を絞れる
- **作詞・作曲者の表示**: 選択した曲に紐づく作品（work）から composer / lyricist / writer などのクレジットを抽出
- **他の作品を探す**: 作詞・作曲者が関わった作品を一覧表示
- **外部リンク**: 各作品から MusicBrainz の作品ページ・YouTube 検索へジャンプ

## 使い方

1. `index.html` をブラウザで開く（ローカルサーバー推奨）
2. 曲名（必要ならアーティスト名も）を入力して「検索」
3. 候補から曲を選択
4. 作詞・作曲者の「この人の他の作品を見る」を押す

ローカルサーバーで開く場合:

```bash
python3 -m http.server 8000
# http://localhost:8000 を開く
```

> `file://` で開いて CORS エラーになる場合は、上記のように HTTP サーバー経由で開いてください。

## 技術構成

- HTML / CSS / Vanilla JavaScript（ビルド不要）
- [MusicBrainz Web Service (WS/2)](https://musicbrainz.org/doc/MusicBrainz_API)
  - `/recording` で曲検索
  - `/recording/{id}` で work / artist の関連を取得
  - `/work/{id}` で作詞・作曲者を取得
  - `/work?artist=` と `/artist/{id}` で作品一覧・役割を取得
- フォント: M PLUS Rounded 1c / Nunito（Google Fonts）

## 注意事項

- MusicBrainz のレート制限（約 1 リクエスト/秒）に合わせて、リクエスト間に待機を入れています。取得に数秒かかることがあります。
- 曲によっては MusicBrainz 上に作品（work）や作詞・作曲者の関連が未登録で、結果が表示されない場合があります。
- 本アプリは MusicBrainz の公式アプリではなく、データは MusicBrainz に帰属します。

## ライセンス

MIT
