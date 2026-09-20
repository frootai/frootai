using System.Globalization;
using System.IO.Compression;
using System.Text;

// A minimal OOXML workbook writer. Sheets are written with inline strings so there is no shared-string
// table to keep consistent, and the package is built with the framework's own zip support so the report
// stays dependency-free like the PDF writer.
internal sealed class XlsxWorkbook
{
    private enum ChartKind { Bar, Pie }
    private sealed record SheetData(string Name, List<SheetRow> Rows, List<ChartSpec> Charts);
    private sealed record SheetRow(IReadOnlyList<Cell> Cells);
    private sealed record ChartSpec(string Title, string CategoryRef, string ValueRef, ChartKind Kind, int AnchorRow, int AnchorColumn);
    private readonly record struct Cell(string Text, CellStyle Style, decimal? Number);

    internal enum CellStyle { Body = 0, Header = 1, Title = 2, Subtle = 3, Money = 4, FactLabel = 5 }

    private readonly List<SheetData> _sheets = [];
    private SheetData _current = new("Sheet1", [], []);

    internal static XlsxWorkbook Begin() => new();

    // The 1-based row a caller is about to write, so it can anchor a chart at its own data.
    internal int NextRow => _current.Rows.Count + 1;

    internal XlsxWorkbook Sheet(string name)
    {
        // Excel rejects these characters in a sheet name and caps the length at 31.
        var safe = new string(name.Where(character => !"[]:*?/\\".Contains(character)).ToArray());
        if (safe.Length > 31) safe = safe[..31];
        _current = new SheetData(safe.Length == 0 ? $"Sheet{_sheets.Count + 1}" : safe, [], []);
        _sheets.Add(_current);
        return this;
    }

    // Draws a bar chart over a block of rows already written to this sheet.
    internal XlsxWorkbook Chart(string title, int firstRow, int lastRow, int labelColumn, int valueColumn)
    {
        if (_sheets.Count == 0 || lastRow < firstRow) return this;
        var sheetRef = $"'{_current.Name.Replace("'", "''")}'";
        _current.Charts.Add(new ChartSpec(
            title,
            $"{sheetRef}!${ColumnName(labelColumn)}${firstRow}:${ColumnName(labelColumn)}${lastRow}",
            $"{sheetRef}!${ColumnName(valueColumn)}${firstRow}:${ColumnName(valueColumn)}${lastRow}",
            ChartKind.Bar,
            Math.Max(0, firstRow - 1),
            Math.Max(5, valueColumn + 2)));
        return this;
    }

    // Pie charts sit to the right of the existing bar charts and intentionally use a bounded set of
    // categories so labels remain readable. The full adjacent table remains the authoritative detail.
    internal XlsxWorkbook PieChart(string title, int firstRow, int lastRow, int labelColumn, int valueColumn, int anchorColumn)
    {
        if (_sheets.Count == 0 || lastRow < firstRow) return this;
        var sheetRef = $"'{_current.Name.Replace("'", "''")}'";
        _current.Charts.Add(new ChartSpec(
            title,
            $"{sheetRef}!${ColumnName(labelColumn)}${firstRow}:${ColumnName(labelColumn)}${lastRow}",
            $"{sheetRef}!${ColumnName(valueColumn)}${firstRow}:${ColumnName(valueColumn)}${lastRow}",
            ChartKind.Pie,
            Math.Max(0, firstRow - 1),
            Math.Max(5, anchorColumn)));
        return this;
    }

    internal XlsxWorkbook Title(string text) => Add([new Cell(text, CellStyle.Title, null)]);

    internal XlsxWorkbook Blank() => Add([]);

    internal XlsxWorkbook Note(string text) => Add([new Cell(text, CellStyle.Subtle, null)]);

    internal XlsxWorkbook Fact(string label, string value)
        => Add([new Cell(label, CellStyle.FactLabel, null), new Cell(value, CellStyle.Body, null)]);

    internal XlsxWorkbook MoneyFact(string label, decimal value)
        => Add([new Cell(label, CellStyle.FactLabel, null), new Cell(string.Empty, CellStyle.Money, value)]);

    internal XlsxWorkbook Headers(params string[] headers)
        => Add([.. headers.Select(header => new Cell(header, CellStyle.Header, null))]);

    internal XlsxWorkbook Row(params string[] values)
        => Add([.. values.Select(value => new Cell(value, CellStyle.Body, null))]);

    // A money cell carries the decimal itself so Excel can sum it, rather than a formatted string.
    internal XlsxWorkbook MoneyRow(IReadOnlyList<string> text, IReadOnlyList<decimal?> numbers)
    {
        var cells = new List<Cell>();
        for (var index = 0; index < text.Count; index++)
        {
            var number = index < numbers.Count ? numbers[index] : null;
            cells.Add(number is null ? new Cell(text[index], CellStyle.Body, null) : new Cell(string.Empty, CellStyle.Money, number));
        }
        return Add(cells);
    }

    private XlsxWorkbook Add(IReadOnlyList<Cell> cells)
    {
        if (_sheets.Count == 0) Sheet("Report");
        _current.Rows.Add(new SheetRow(cells));
        return this;
    }

    internal byte[] End()
    {
        if (_sheets.Count == 0) Sheet("Report");
        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            Write(archive, "[Content_Types].xml", ContentTypes());
            Write(archive, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            Write(archive, "xl/workbook.xml", WorkbookXml());
            Write(archive, "xl/_rels/workbook.xml.rels", WorkbookRels());
            Write(archive, "xl/styles.xml", StylesXml());
            var chartNumber = 0;
            for (var index = 0; index < _sheets.Count; index++)
            {
                var sheet = _sheets[index];
                Write(archive, $"xl/worksheets/sheet{index + 1}.xml", SheetXml(sheet));
                if (sheet.Charts.Count == 0) continue;
                var first = chartNumber + 1;
                Write(archive, $"xl/worksheets/_rels/sheet{index + 1}.xml.rels", SheetRels(index + 1));
                Write(archive, $"xl/drawings/drawing{index + 1}.xml", DrawingXml(sheet));
                Write(archive, $"xl/drawings/_rels/drawing{index + 1}.xml.rels", DrawingRels(sheet, first));
                foreach (var chart in sheet.Charts) Write(archive, $"xl/charts/chart{++chartNumber}.xml", ChartXml(chart));
            }
        }
        return buffer.ToArray();
    }

    private static void Write(ZipArchive archive, string path, string content)
    {
        using var stream = archive.CreateEntry(path, CompressionLevel.Optimal).Open();
        var bytes = Encoding.UTF8.GetBytes(content);
        stream.Write(bytes, 0, bytes.Length);
    }

    private string ContentTypes()
    {
        var builder = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>");
        for (var index = 0; index < _sheets.Count; index++) builder.Append(CultureInfo.InvariantCulture, $"<Override PartName=\"/xl/worksheets/sheet{index + 1}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
        var charts = 0;
        for (var index = 0; index < _sheets.Count; index++)
        {
            if (_sheets[index].Charts.Count == 0) continue;
            builder.Append(CultureInfo.InvariantCulture, $"<Override PartName=\"/xl/drawings/drawing{index + 1}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.drawing+xml\"/>");
            foreach (var _ in _sheets[index].Charts) builder.Append(CultureInfo.InvariantCulture, $"<Override PartName=\"/xl/charts/chart{++charts}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.drawingml.chart+xml\"/>");
        }
        return builder.Append("</Types>").ToString();
    }

    private string WorkbookXml()
    {
        var builder = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><bookViews><workbookView activeTab=\"0\"/></bookViews><sheets>");
        for (var index = 0; index < _sheets.Count; index++) builder.Append(CultureInfo.InvariantCulture, $"<sheet name=\"{Escape(_sheets[index].Name)}\" sheetId=\"{index + 1}\" r:id=\"rId{index + 1}\"/>");
        builder.Append("</sheets><definedNames>");
        for (var index = 0; index < _sheets.Count; index++)
        {
            var header = FirstHeaderRow(_sheets[index]);
            if (header == 0) continue;
            var sheet = $"'{_sheets[index].Name.Replace("'", "''")}'";
            builder.Append(CultureInfo.InvariantCulture, $"<definedName name=\"_xlnm.Print_Titles\" localSheetId=\"{index}\">{Escape(sheet)}!${header}:${header}</definedName>");
        }
        return builder.Append("</definedNames></workbook>").ToString();
    }

    private string WorkbookRels()
    {
        var builder = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">");
        for (var index = 0; index < _sheets.Count; index++) builder.Append(CultureInfo.InvariantCulture, $"<Relationship Id=\"rId{index + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet{index + 1}.xml\"/>");
        builder.Append(CultureInfo.InvariantCulture, $"<Relationship Id=\"rId{_sheets.Count + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>");
        return builder.Append("</Relationships>").ToString();
    }

    private static string StylesXml() =>
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
        "<numFmts count=\"1\"><numFmt numFmtId=\"164\" formatCode=\"#,##0.00\"/></numFmts>" +
        "<fonts count=\"5\">" +
        "<font><sz val=\"11\"/><color rgb=\"FF24312B\"/><name val=\"Aptos\"/></font>" +
        "<font><b/><sz val=\"11\"/><color rgb=\"FFFFFFFF\"/><name val=\"Aptos\"/></font>" +
        "<font><b/><sz val=\"18\"/><color rgb=\"FFFFFFFF\"/><name val=\"Aptos Display\"/></font>" +
        "<font><i/><sz val=\"10\"/><color rgb=\"FF52635A\"/><name val=\"Aptos\"/></font>" +
        "<font><b/><sz val=\"10\"/><color rgb=\"FF0B4F42\"/><name val=\"Aptos\"/></font>" +
        "</fonts>" +
        "<fills count=\"5\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF0B4F42\"/><bgColor indexed=\"64\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFE8F3ED\"/><bgColor indexed=\"64\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFF5F8F6\"/><bgColor indexed=\"64\"/></patternFill></fill></fills>" +
        "<borders count=\"2\"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style=\"thin\"><color rgb=\"FFD9E2DD\"/></left><right style=\"thin\"><color rgb=\"FFD9E2DD\"/></right><top style=\"thin\"><color rgb=\"FFD9E2DD\"/></top><bottom style=\"thin\"><color rgb=\"FFD9E2DD\"/></bottom><diagonal/></border></borders>" +
        "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
        "<cellXfs count=\"10\">" +
        "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyAlignment=\"1\"><alignment vertical=\"top\" wrapText=\"1\"/></xf>" +
        "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"center\" wrapText=\"1\"/></xf>" +
        "<xf numFmtId=\"0\" fontId=\"2\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyAlignment=\"1\"><alignment vertical=\"center\"/></xf>" +
        "<xf numFmtId=\"0\" fontId=\"3\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"center\" wrapText=\"1\"/></xf>" +
        "<xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\" applyAlignment=\"1\"><alignment horizontal=\"right\" vertical=\"top\"/></xf>" +
        "<xf numFmtId=\"0\" fontId=\"4\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"center\" wrapText=\"1\"/></xf>" +
        "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"top\" wrapText=\"1\"/></xf>" +
        "<xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"right\" vertical=\"top\"/></xf>" +
        "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"4\" borderId=\"1\" xfId=\"0\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"top\" wrapText=\"1\"/></xf>" +
        "<xf numFmtId=\"164\" fontId=\"0\" fillId=\"4\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"right\" vertical=\"top\"/></xf>" +
        "</cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>";

    private static string SheetXml(SheetData sheet)
    {
        var widest = sheet.Rows.Count == 0 ? 1 : sheet.Rows.Max(row => row.Cells.Count);
        var widths = Enumerable.Range(0, Math.Max(1, widest)).Select(column => ColumnWidth(sheet, column)).ToArray();
        var lastCell = $"{ColumnName(Math.Max(0, widest - 1))}{Math.Max(1, sheet.Rows.Count)}";
        var headerRow = FirstHeaderRow(sheet);
        var builder = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">");
        builder.Append("<sheetPr><tabColor rgb=\"FF17866F\"/><pageSetUpPr fitToPage=\"1\"/></sheetPr>");
        builder.Append(CultureInfo.InvariantCulture, $"<dimension ref=\"A1:{lastCell}\"/><sheetViews><sheetView workbookViewId=\"0\">");
        if (headerRow > 0) builder.Append(CultureInfo.InvariantCulture, $"<pane ySplit=\"{headerRow}\" topLeftCell=\"A{headerRow + 1}\" activePane=\"bottomLeft\" state=\"frozen\"/><selection pane=\"bottomLeft\" activeCell=\"A{headerRow + 1}\" sqref=\"A{headerRow + 1}\"/>");
        builder.Append("</sheetView></sheetViews><sheetFormatPr defaultRowHeight=\"18\"/><cols>");
        for (var column = 0; column < Math.Max(1, widest); column++)
        {
            builder.Append(CultureInfo.InvariantCulture, $"<col min=\"{column + 1}\" max=\"{column + 1}\" width=\"{widths[column]:0.##}\" bestFit=\"1\" customWidth=\"1\"/>");
        }
        builder.Append("</cols><sheetData>");
        var tableRow = -1;
        for (var index = 0; index < sheet.Rows.Count; index++)
        {
            var row = sheet.Rows[index];
            var isHeader = row.Cells.Count > 1 && row.Cells.All(cell => cell.Style == CellStyle.Header);
            if (isHeader) tableRow = 0;
            else if (row.Cells.Count == 0) tableRow = -1;
            var height = RowHeight(row, widths, widest);
            builder.Append(CultureInfo.InvariantCulture, $"<row r=\"{index + 1}\" ht=\"{height:0.##}\" customHeight=\"1\">");
            for (var column = 0; column < row.Cells.Count; column++)
            {
                var cell = row.Cells[column];
                var reference = $"{ColumnName(column)}{index + 1}";
                var style = TableStyle(cell.Style, tableRow);
                if (cell.Number is decimal number)
                {
                    builder.Append(CultureInfo.InvariantCulture, $"<c r=\"{reference}\" s=\"{style}\"><v>{number.ToString(CultureInfo.InvariantCulture)}</v></c>");
                }
                else
                {
                    builder.Append(CultureInfo.InvariantCulture, $"<c r=\"{reference}\" s=\"{style}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{Escape(cell.Text)}</t></is></c>");
                }
            }
            builder.Append("</row>");
            if (!isHeader && tableRow >= 0) tableRow += 1;
        }
        builder.Append("</sheetData>");
        var filter = AutoFilterRange(sheet, headerRow, widest);
        if (filter is not null) builder.Append(CultureInfo.InvariantCulture, $"<autoFilter ref=\"{filter}\"/>");
        var merged = sheet.Rows.Select((row, index) => (row, index)).Where(item => widest > 1 && item.row.Cells.Count == 1 && item.row.Cells[0].Style is CellStyle.Title or CellStyle.Subtle).ToArray();
        if (merged.Length > 0)
        {
            builder.Append(CultureInfo.InvariantCulture, $"<mergeCells count=\"{merged.Length}\">");
            foreach (var item in merged) builder.Append(CultureInfo.InvariantCulture, $"<mergeCell ref=\"A{item.index + 1}:{ColumnName(widest - 1)}{item.index + 1}\"/>");
            builder.Append("</mergeCells>");
        }
        builder.Append("<printOptions horizontalCentered=\"1\"/><pageMargins left=\"0.3\" right=\"0.3\" top=\"0.55\" bottom=\"0.55\" header=\"0.2\" footer=\"0.25\"/>");
        var landscape = widest > 4 || sheet.Charts.Count > 0;
        builder.Append(CultureInfo.InvariantCulture, $"<pageSetup paperSize=\"9\" orientation=\"{(landscape ? "landscape" : "portrait")}\" fitToWidth=\"1\" fitToHeight=\"{(sheet.Charts.Count == 0 ? 1 : 0)}\"/>");
        builder.Append("<headerFooter><oddFooter>&amp;LAzure Cost Optimizer&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>");
        // The drawing reference has to follow sheetData or Excel rejects the part.
        if (sheet.Charts.Count > 0) builder.Append("<drawing r:id=\"rId1\"/>");
        return builder.Append("</worksheet>").ToString();
    }

    private static int FirstHeaderRow(SheetData sheet)
        => sheet.Rows.FindIndex(row => row.Cells.Count > 1 && row.Cells.All(cell => cell.Style == CellStyle.Header)) + 1;

    private static double ColumnWidth(SheetData sheet, int column)
    {
        var content = sheet.Rows
            .Where(row => column < row.Cells.Count && row.Cells[column].Style is CellStyle.Body or CellStyle.Header or CellStyle.Money or CellStyle.FactLabel)
            .Select(row => row.Cells[column].Number?.ToString("#,##0.00", CultureInfo.InvariantCulture) ?? row.Cells[column].Text)
            .DefaultIfEmpty(string.Empty);
        var longest = content.Max(value => value.Split('\n').Max(line => line.Length));
        var minimum = column == 0 ? 18 : 12;
        var maximum = column == 0 ? 42 : 36;
        return Math.Clamp(longest + 2, minimum, maximum);
    }

    private static double RowHeight(SheetRow row, IReadOnlyList<double> widths, int widest)
    {
        if (row.Cells.Count == 0) return 9;
        if (row.Cells.Count == 1 && row.Cells[0].Style == CellStyle.Title) return 30;
        var available = row.Cells.Count == 1 && row.Cells[0].Style == CellStyle.Subtle ? widths.Sum() : 0;
        var lines = row.Cells.Select((cell, column) =>
        {
            var text = cell.Number?.ToString("#,##0.00", CultureInfo.InvariantCulture) ?? cell.Text;
            var width = available > 0 ? available : widths[Math.Min(column, widths.Count - 1)];
            return text.Split('\n').Sum(part => Math.Max(1, (int)Math.Ceiling(part.Length / Math.Max(8, width - 1))));
        }).DefaultIfEmpty(1).Max();
        var header = row.Cells.Count > 1 && row.Cells.All(cell => cell.Style == CellStyle.Header);
        return Math.Clamp((lines * 15) + (header ? 8 : 4), header ? 23 : 18, 120);
    }

    private static int TableStyle(CellStyle style, int tableRow)
    {
        if (tableRow < 0 || style is not (CellStyle.Body or CellStyle.Money)) return (int)style;
        var alternate = tableRow % 2 == 1;
        return style == CellStyle.Money ? alternate ? 9 : 7 : alternate ? 8 : 6;
    }

    private static string? AutoFilterRange(SheetData sheet, int headerRow, int widest)
    {
        if (headerRow == 0) return null;
        var last = headerRow;
        for (var index = headerRow; index < sheet.Rows.Count; index++)
        {
            var row = sheet.Rows[index];
            if (row.Cells.Count == 0 || row.Cells.All(cell => cell.Style == CellStyle.Header)) break;
            last = index + 1;
        }
        return $"A{headerRow}:{ColumnName(widest - 1)}{last}";
    }

    private static string SheetRels(int sheetNumber) =>
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
        $"<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing\" Target=\"../drawings/drawing{sheetNumber}.xml\"/></Relationships>";

    private static string DrawingRels(SheetData sheet, int firstChartNumber)
    {
        var builder = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">");
        for (var index = 0; index < sheet.Charts.Count; index++)
            builder.Append(CultureInfo.InvariantCulture, $"<Relationship Id=\"rId{index + 1}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart\" Target=\"../charts/chart{firstChartNumber + index}.xml\"/>");
        return builder.Append("</Relationships>").ToString();
    }

    private static string DrawingXml(SheetData sheet)
    {
        var builder = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><xdr:wsDr xmlns:xdr=\"http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\">");
        for (var index = 0; index < sheet.Charts.Count; index++)
        {
            var chart = sheet.Charts[index];
            var top = chart.AnchorRow;
            var anchor =
                $"<xdr:twoCellAnchor><xdr:from><xdr:col>{chart.AnchorColumn}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>{top}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>"
                + $"<xdr:to><xdr:col>{chart.AnchorColumn + 6}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>{top + 18}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>"
                + $"<xdr:graphicFrame macro=\"\"><xdr:nvGraphicFramePr><xdr:cNvPr id=\"{index + 2}\" name=\"Chart {index + 1}\"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>"
                + "<xdr:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"0\" cy=\"0\"/></xdr:xfrm>"
                + "<a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/chart\">"
                + $"<c:chart xmlns:c=\"http://schemas.openxmlformats.org/drawingml/2006/chart\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" r:id=\"rId{index + 1}\"/>"
                + "</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>";
            builder.Append(anchor);
        }
        return builder.Append("</xdr:wsDr>").ToString();
    }

    private static string ChartXml(ChartSpec chart)
    {
        var series =
            "<c:ser><c:idx val=\"0\"/><c:order val=\"0\"/>" +
            $"<c:cat><c:strRef><c:f>{Escape(chart.CategoryRef)}</c:f></c:strRef></c:cat>" +
            $"<c:val><c:numRef><c:f>{Escape(chart.ValueRef)}</c:f></c:numRef></c:val></c:ser>";
        var plot = chart.Kind == ChartKind.Pie
            ? "<c:pieChart><c:varyColors val=\"1\"/>" + series + "<c:firstSliceAng val=\"270\"/></c:pieChart>"
            : "<c:barChart><c:barDir val=\"bar\"/><c:grouping val=\"clustered\"/><c:varyColors val=\"0\"/>" +
              "<c:ser><c:idx val=\"0\"/><c:order val=\"0\"/><c:spPr><a:solidFill><a:srgbClr val=\"007F73\"/></a:solidFill></c:spPr><c:invertIfNegative val=\"0\"/>" +
              $"<c:cat><c:strRef><c:f>{Escape(chart.CategoryRef)}</c:f></c:strRef></c:cat>" +
              $"<c:val><c:numRef><c:f>{Escape(chart.ValueRef)}</c:f></c:numRef></c:val>" +
              "</c:ser><c:gapWidth val=\"60\"/><c:axId val=\"411110001\"/><c:axId val=\"411110002\"/></c:barChart>" +
              "<c:catAx><c:axId val=\"411110001\"/><c:scaling><c:orientation val=\"maxMin\"/></c:scaling><c:delete val=\"0\"/><c:axPos val=\"l\"/><c:crossAx val=\"411110002\"/></c:catAx>" +
              "<c:valAx><c:axId val=\"411110002\"/><c:scaling><c:orientation val=\"minMax\"/></c:scaling><c:delete val=\"0\"/><c:axPos val=\"b\"/><c:numFmt formatCode=\"#,##0\" sourceLinked=\"0\"/><c:crossAx val=\"411110001\"/></c:valAx>";
        var legend = chart.Kind == ChartKind.Pie ? "<c:legend><c:legendPos val=\"r\"/><c:layout/><c:overlay val=\"0\"/></c:legend>" : string.Empty;
        return
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            "<c:chartSpace xmlns:c=\"http://schemas.openxmlformats.org/drawingml/2006/chart\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
            "<c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz=\"1200\" b=\"1\"/></a:pPr>" +
            $"<a:r><a:rPr lang=\"en-US\" sz=\"1200\" b=\"1\"/><a:t>{Escape(chart.Title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val=\"0\"/></c:title>" +
            $"<c:autoTitleDeleted val=\"0\"/><c:plotArea><c:layout/>{plot}</c:plotArea>{legend}<c:plotVisOnly val=\"1\"/><c:dispBlanksAs val=\"gap\"/></c:chart></c:chartSpace>";
    }

    private static string ColumnName(int index)
    {
        var name = string.Empty;
        for (var value = index; ; value = (value / 26) - 1)
        {
            name = (char)('A' + (value % 26)) + name;
            if (value < 26) return name;
        }
    }

    // XML 1.0 has no escape for control characters, so they are dropped rather than producing a file Excel refuses.
    private static string Escape(string value)
    {
        var builder = new StringBuilder(value.Length + 8);
        foreach (var character in value)
        {
            if (character is '<') builder.Append("&lt;");
            else if (character is '>') builder.Append("&gt;");
            else if (character is '&') builder.Append("&amp;");
            else if (character is '"') builder.Append("&quot;");
            else if (character is '\'') builder.Append("&apos;");
            else if (character is '\n' or '\t') builder.Append(character);
            else if (character < 32) continue;
            else builder.Append(character);
        }
        return builder.ToString();
    }
}
