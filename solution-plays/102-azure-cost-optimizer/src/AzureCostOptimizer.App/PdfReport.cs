using System.Globalization;
using System.Text;

// A minimal PDF 1.4 writer using the standard Helvetica fonts. It avoids native font/graphics dependencies
// so the report renders identically in the container, and it keeps report generation deterministic.
internal sealed class PdfReport
{
    private const int PageWidth = 595;
    private const int PageHeight = 842;
    private const int Margin = 46;
    private const int ContentWidth = PageWidth - (Margin * 2);
    private const int BodySize = 9;
    private const int LineHeight = 13;
    private const int BottomLimit = Margin + 26;

    // Helvetica advance widths are approximated because there is no font engine to measure with.
    private const double AverageGlyphWidth = 0.50;
    private const double BoldGlyphWidth = 0.55;

    private readonly List<string> _pages = [];
    // Headings are recorded as they are laid out so the contents page can be written once the page count is known.
    private readonly List<(string Heading, int Page)> _outline = [];
    private readonly StringBuilder _content = new();
    private readonly string _title;
    private readonly string _subtitle;
    private int _y;
    private bool _plain;
    private int _reserved = -1;

    private PdfReport(string title, string subtitle)
    {
        _title = title;
        _subtitle = subtitle;
        StartPage();
    }

    internal static PdfReport Begin(string title, string subtitle) => new(title, subtitle);

    // The cover carries no running header, so it is laid out on a page of its own before anything else.
    internal PdfReport Cover(string product, string platform, string strapline, IReadOnlyList<(string Label, string Value)> facts, string notice)
    {
        _content.Clear();
        _plain = true;
        Rectangle(0, PageHeight - 232, PageWidth, 232, (0.04, 0.27, 0.23));
        _content.Append("1 1 1 rg\n");
        WriteText(Margin, PageHeight - 96, true, 26, product);
        _content.Append("0.66 0.85 0.79 rg\n");
        WriteText(Margin, PageHeight - 124, false, 11, platform);
        _content.Append("0.82 0.92 0.88 rg\n");
        var strapY = PageHeight - 160;
        foreach (var line in Wrap(strapline, ContentWidth - 40, 10, false))
        {
            WriteText(Margin, strapY, false, 10, line);
            strapY -= 14;
        }
        _content.Append("0 0 0 rg\n");
        _y = PageHeight - 300;
        foreach (var (label, value) in facts)
        {
            _content.Append("0.35 0.42 0.38 rg\n");
            WriteText(Margin, _y, false, 9, label.ToUpperInvariant());
            _content.Append("0 0 0 rg\n");
            foreach (var line in Wrap(value, ContentWidth - 180, 11, true))
            {
                WriteText(Margin + 180, _y, true, 11, line);
                _y -= 16;
            }
            _y -= 6;
        }
        Rule(Margin + 92);
        _content.Append("0.35 0.42 0.38 rg\n");
        var noticeY = Margin + 74;
        foreach (var line in Wrap(notice, ContentWidth, 8, false))
        {
            WriteText(Margin, noticeY, false, 8, line);
            noticeY -= 11;
        }
        _content.Append("0 0 0 rg\n");
        EndPage();
        // The contents page is written last but belongs here, so its slot is held open.
        _reserved = _pages.Count;
        _pages.Add(string.Empty);
        _plain = false;
        StartPage();
        return this;
    }

    internal PdfReport Section(string heading, int minimumPoints = 230)
    {
        // Reserve enough room for the heading, its introduction and a meaningful opening block.
        EnsureSpace(minimumPoints);
        Advance();
        _outline.Add((heading, _pages.Count + 1));
        _content.Append("0.04 0.44 0.38 rg\n");
        WriteText(Margin, _y, true, 11, heading);
        _content.Append("0 0 0 rg\n");
        Advance();
        Rule(_y + 9);
        return this;
    }

    internal PdfReport Facts(IReadOnlyList<(string Label, string Value)> facts)
    {
        foreach (var ((label, value), index) in facts.Select((fact, index) => (fact, index)))
        {
            var lines = Wrap(value, ContentWidth - 174, BodySize, false);
            var rowHeight = Math.Max(24, (lines.Count * LineHeight) + 8);
            EnsureSpace(rowHeight);
            if (index % 2 == 0) Rectangle(Margin, _y - rowHeight + 7, ContentWidth, rowHeight, (0.96, 0.98, 0.97));
            WriteText(Margin + 8, _y - 4, true, BodySize, label);
            for (var line = 0; line < lines.Count; line++)
            {
                WriteText(Margin + 174, _y - 4 - (line * LineHeight), false, BodySize, lines[line]);
            }
            _y -= rowHeight;
        }
        Advance();
        return this;
    }

    internal PdfReport Table(IReadOnlyList<string> headers, IReadOnlyList<int> widths, IReadOnlyList<IReadOnlyList<string>> rows)
    {
        const int headerHeight = 23;
        const int cellPadding = 7;

        void Header()
        {
            Rectangle(Margin, _y - headerHeight + 7, ContentWidth, headerHeight, (0.04, 0.31, 0.27));
            _content.Append("1 1 1 rg\n");
            var x = Margin;
            for (var index = 0; index < headers.Count; index++)
            {
                var right = index == headers.Count - 1 && headers.Count > 1;
                WriteText(right ? x + widths[index] - cellPadding - (int)Measure(headers[index], BodySize, true) : x + cellPadding, _y - 3, true, BodySize, headers[index]);
                x += widths[index];
            }
            _content.Append("0 0 0 rg\n");
            _y -= headerHeight;
        }

        var layouts = rows.Select(row =>
        {
            var cells = new List<List<string>>();
            for (var index = 0; index < widths.Count; index++)
            {
                cells.Add(Wrap(index < row.Count ? row[index] : string.Empty, widths[index] - (cellPadding * 2), BodySize, false));
            }
            var lines = Math.Max(1, cells.Max(cell => cell.Count));
            return (Cells: cells, Height: (LineHeight * lines) + 6);
        }).ToArray();

        EnsureSpace(headerHeight + layouts.Take(3).Sum(layout => layout.Height));
        Header();
        var rowIndex = 0;
        while (rowIndex < layouts.Length)
        {
            var available = _y - BottomLimit;
            var fit = 0;
            var used = 0;
            while (rowIndex + fit < layouts.Length && used + layouts[rowIndex + fit].Height <= available)
            {
                used += layouts[rowIndex + fit].Height;
                fit += 1;
            }

            if (fit == 0)
            {
                EndPage();
                StartPage();
                Header();
                continue;
            }

            var remaining = layouts.Length - rowIndex;
            const int minimumContinuation = 4;
            if (fit < remaining && remaining - fit < minimumContinuation && fit > minimumContinuation)
                fit -= minimumContinuation - (remaining - fit);

            for (var pageRow = 0; pageRow < fit; pageRow++, rowIndex++)
            {
                var layout = layouts[rowIndex];
                if (rowIndex % 2 == 0) Rectangle(Margin, _y - layout.Height + 4, ContentWidth, layout.Height, (0.965, 0.978, 0.972));
                var top = _y;
                var x = Margin;
                for (var column = 0; column < widths.Count; column++)
                {
                    var right = column == widths.Count - 1 && widths.Count > 1;
                    for (var line = 0; line < layout.Cells[column].Count; line++)
                    {
                        var text = layout.Cells[column][line];
                        WriteText(right ? x + widths[column] - cellPadding - (int)Measure(text, BodySize, false) : x + cellPadding, top - 4 - (line * LineHeight), false, BodySize, text);
                    }
                    x += widths[column];
                }
                _y = top - layout.Height;
                _content.Append(CultureInfo.InvariantCulture, $"0.35 w 0.86 0.89 0.87 RG {Margin} {_y + 4} m {PageWidth - Margin} {_y + 4} l S 0 0 0 RG\n");
            }

            if (rowIndex < layouts.Length)
            {
                EndPage();
                StartPage();
                Header();
            }
        }
        Advance();
        return this;
    }

    internal PdfReport Paragraph(string text)
    {
        foreach (var line in Wrap(text, ContentWidth, BodySize, false))
        {
            EnsureRoom(1);
            WriteText(Margin, _y, false, BodySize, line);
            Advance();
        }
        return this;
    }

    internal PdfReport Bullets(IEnumerable<string> items)
    {
        var wrapped = items.Select(item => Wrap(item, ContentWidth - 14, BodySize, false)).ToArray();
        // A short list that would straddle a page break moves whole, so a few orphan lines do not become a page.
        var total = wrapped.Sum(lines => lines.Count);
        if (total is > 0 and <= 14) EnsureRoom(total);
        foreach (var lines in wrapped)
        {
            for (var index = 0; index < lines.Count; index++)
            {
                EnsureRoom(1);
                if (index == 0) WriteText(Margin, _y, false, BodySize, "-");
                WriteText(Margin + 12, _y, false, BodySize, lines[index]);
                Advance();
            }
        }
        return this;
    }

    internal byte[] End()
    {
        EndPage();
        if (_reserved >= 0)
        {
            if (_outline.Count > 0) _pages[_reserved] = BuildContents();
            else _pages.RemoveAt(_reserved);
        }
        for (var index = 0; index < _pages.Count; index++)
        {
            if (index == 0) continue;
            _pages[index] += Footer(index + 1);
        }
        return Build(_pages, _title);
    }

    private string Footer(int page)
    {
        var builder = new StringBuilder("0.45 0.50 0.47 rg\n");
        var text = $"Page {page} of {_pages.Count}  -  Azure Cost Optimizer  -  Estimates are not realized savings. Review with an authorized human before acting.";
        builder.Append(CultureInfo.InvariantCulture, $"BT /F1 7 Tf {Margin} {Margin - 6} Td ({Escape(text)}) Tj ET\n0 0 0 rg\n");
        return builder.ToString();
    }

    private string BuildContents()
    {
        var page = new StringBuilder();
        page.Append("0.04 0.44 0.38 rg\n");
        page.Append(CultureInfo.InvariantCulture, $"BT /F2 15 Tf {Margin} {PageHeight - Margin} Td ({Escape(_title)}) Tj ET\n");
        page.Append("0.45 0.50 0.47 rg\n");
        page.Append(CultureInfo.InvariantCulture, $"BT /F1 8 Tf {PageWidth - Margin - (int)Measure(_subtitle, 8, false)} {PageHeight - Margin} Td ({Escape(_subtitle)}) Tj ET\n");
        page.Append(CultureInfo.InvariantCulture, $"0 0 0 rg\n0.5 w 0.82 0.87 0.84 RG {Margin} {PageHeight - Margin - 10} m {PageWidth - Margin} {PageHeight - Margin - 10} l S 0 0 0 RG\n");
        page.Append("0.04 0.44 0.38 rg\n");
        page.Append(CultureInfo.InvariantCulture, $"BT /F2 11 Tf {Margin} {PageHeight - Margin - 44} Td (Contents) Tj ET\n0 0 0 rg\n");
        var y = PageHeight - Margin - 72;
        foreach (var (heading, target) in _outline)
        {
            var number = target.ToString(CultureInfo.InvariantCulture);
            page.Append(CultureInfo.InvariantCulture, $"BT /F1 {BodySize} Tf {Margin} {y} Td ({Escape(heading)}) Tj ET\n");
            page.Append(CultureInfo.InvariantCulture, $"BT /F1 {BodySize} Tf {PageWidth - Margin - (int)Measure(number, BodySize, false)} {y} Td ({Escape(number)}) Tj ET\n");
            page.Append(CultureInfo.InvariantCulture, $"0.4 w 0.88 0.91 0.89 RG {Margin + (int)Measure(heading, BodySize, false) + 6} {y + 3} m {PageWidth - Margin - (int)Measure(number, BodySize, false) - 6} {y + 3} l S 0 0 0 RG\n");
            y -= 17;
            if (y < BottomLimit) break;
        }
        return page.ToString();
    }

    // Charts are drawn with PDF path operators rather than an image library, so the report stays
    // dependency-free and renders identically wherever the container runs.
    private static readonly (double R, double G, double B)[] Palette =
    [
        (0.00, 0.50, 0.45), (0.00, 0.40, 0.72), (0.68, 0.46, 0.16), (0.48, 0.31, 0.64),
        (0.11, 0.54, 0.35), (0.76, 0.33, 0.24), (0.23, 0.49, 0.65), (0.54, 0.50, 0.17),
        (0.36, 0.44, 0.49), (0.64, 0.31, 0.47), (0.18, 0.56, 0.56), (0.42, 0.50, 0.23),
    ];

    internal PdfReport BarChart(IReadOnlyList<(string Label, decimal Value)> items, Func<decimal, string> format)
    {
        if (items.Count == 0) return this;
        const int rowHeight = 15;
        const int labelWidth = 150;
        const int valueWidth = 86;
        var barArea = ContentWidth - labelWidth - valueWidth - 8;
        var peak = items.Max(item => Math.Abs(item.Value));
        EnsureSpace((items.Count * rowHeight) + 10);
        Advance();
        foreach (var (item, index) in items.Select((item, index) => (item, index)))
        {
            if (_y - rowHeight < BottomLimit) { EndPage(); StartPage(); }
            var width = peak > 0 ? (int)Math.Round((double)Math.Abs(item.Value) / (double)peak * barArea) : 0;
            var colour = Palette[index % Palette.Length];
            WriteText(Margin, _y, false, 8, Truncate(item.Label, labelWidth - 6, 8));
            if (width > 0) Rectangle(Margin + labelWidth, _y - 2, Math.Max(width, 1), 9, colour);
            var value = format(item.Value);
            WriteText(PageWidth - Margin - (int)Measure(value, 8, false), _y, false, 8, value);
            _y -= rowHeight;
        }
        Advance();
        return this;
    }

    internal PdfReport DonutChart(IReadOnlyList<(string Label, decimal Value)> items, Func<decimal, string> format)
    {
        var positive = items.Where(item => item.Value > 0).ToArray();
        if (positive.Length < 2) return this;
        const int radius = 58;
        var height = Math.Max((radius * 2) + 18, (positive.Length * 12) + 14);
        EnsureSpace(height);
        Advance();
        var total = positive.Sum(item => item.Value);
        var centreX = Margin + radius + 6;
        var centreY = _y - radius;
        var angle = Math.PI / 2;
        for (var index = 0; index < positive.Length; index++)
        {
            var sweep = (double)(positive[index].Value / total) * Math.PI * 2;
            Wedge(centreX, centreY, radius, angle, angle - sweep, Palette[index % Palette.Length]);
            angle -= sweep;
        }
        Circle(centreX, centreY, radius * 0.56, (1, 1, 1));

        var legendX = Margin + (radius * 2) + 26;
        var legendY = _y - 6;
        for (var index = 0; index < positive.Length; index++)
        {
            Rectangle(legendX, legendY - 1, 7, 7, Palette[index % Palette.Length]);
            var percent = (double)(positive[index].Value / total) * 100;
            var label = $"{Truncate(positive[index].Label, 150, 8)}  {percent.ToString("0.0", CultureInfo.InvariantCulture)}%  {format(positive[index].Value)}";
            WriteText(legendX + 12, legendY, false, 8, label);
            legendY -= 12;
        }
        _y -= height;
        Advance();
        return this;
    }

    internal PdfReport LineChart(IReadOnlyList<(string Label, decimal Value)> points, Func<decimal, string> format)
    {
        if (points.Count < 2) return this;
        const int plotHeight = 118;
        EnsureSpace(plotHeight + 30);
        Advance();
        var top = _y - 6;
        var baseline = top - plotHeight;
        var peak = points.Max(item => item.Value);
        var floor = Math.Min(0m, points.Min(item => item.Value));
        var span = peak - floor;
        var step = points.Count > 1 ? (double)ContentWidth / (points.Count - 1) : 0;
        double PointY(decimal value) => span > 0 ? baseline + ((double)((value - floor) / span) * plotHeight) : baseline;

        // Gridlines first so the series is drawn over them.
        for (var line = 0; line <= 2; line++)
        {
            var y = baseline + (plotHeight / 2.0 * line);
            _content.Append(CultureInfo.InvariantCulture, $"0.5 w 0.88 0.91 0.89 RG {Margin} {y:0.##} m {PageWidth - Margin} {y:0.##} l S\n");
        }
        _content.Append(CultureInfo.InvariantCulture, $"1.4 w 0.00 0.40 0.72 RG {Margin} {PointY(points[0].Value):0.##} m");
        for (var index = 1; index < points.Count; index++)
        {
            _content.Append(CultureInfo.InvariantCulture, $" {Margin + (step * index):0.##} {PointY(points[index].Value):0.##} l");
        }
        _content.Append(" S\n0 0 0 RG\n");
        for (var index = 0; index < points.Count; index++)
        {
            Circle(Margin + (step * index), PointY(points[index].Value), 1.9, (0.00, 0.40, 0.72));
        }

        _content.Append("0.45 0.50 0.47 rg\n");
        WriteText(Margin, (int)baseline - 12, false, 7, points[0].Label);
        var lastLabel = points[^1].Label;
        WriteText(PageWidth - Margin - (int)Measure(lastLabel, 7, false), (int)baseline - 12, false, 7, lastLabel);
        WriteText(Margin, (int)top + 4, false, 7, $"peak {format(peak)}");
        _content.Append("0 0 0 rg\n");
        _y = (int)baseline - 24;
        Advance();
        return this;
    }

    internal PdfReport Flow(IReadOnlyList<(string Kind, string Label, string Detail, string Branches)> nodes)
    {
        foreach (var (node, index) in nodes.Select((node, index) => (node, index)))
        {
            var detail = node.Detail is { Length: > 0 } ? Wrap(node.Detail, ContentWidth - 46, 8, false) : [];
            var branches = node.Branches is { Length: > 0 } ? Wrap(node.Branches, ContentWidth - 46, 8, false) : [];
            EnsureSpace(20 + ((detail.Count + branches.Count) * 11));
            var markerY = _y - 1;
            var colour = node.Kind switch
            {
                "start" => (0.11, 0.54, 0.35),
                "decision" => (0.68, 0.46, 0.16),
                "end" => (0.48, 0.31, 0.64),
                _ => (0.00, 0.40, 0.72),
            };
            if (node.Kind == "decision") Diamond(Margin + 8, markerY + 2, 8, colour);
            else Circle(Margin + 8, markerY + 2, 7, colour);
            _content.Append("1 1 1 rg\n");
            WriteText(Margin + 6, markerY - 1, true, 7, node.Kind == "decision" ? "?" : (index + 1).ToString(CultureInfo.InvariantCulture));
            _content.Append("0 0 0 rg\n");
            WriteText(Margin + 24, _y, true, 9, Truncate(node.Label, ContentWidth - 30, 9));
            Advance();
            _content.Append("0.35 0.40 0.37 rg\n");
            foreach (var line in detail) { WriteText(Margin + 24, _y, false, 8, line); _y -= 11; }
            _content.Append("0.20 0.36 0.30 rg\n");
            foreach (var line in branches) { WriteText(Margin + 24, _y, false, 8, line); _y -= 11; }
            _content.Append("0 0 0 rg\n");
            _y -= 8;
            if (_y < BottomLimit) { EndPage(); StartPage(); }
        }
        Advance();
        return this;
    }

    private void EnsureSpace(int points)
    {
        if (_y - points >= BottomLimit) return;
        EndPage();
        StartPage();
    }

    private void Rectangle(double x, double y, double width, double height, (double R, double G, double B) colour)
        => _content.Append(CultureInfo.InvariantCulture, $"{colour.R:0.###} {colour.G:0.###} {colour.B:0.###} rg {x:0.##} {y:0.##} {width:0.##} {height:0.##} re f 0 0 0 rg\n");

    private void Circle(double cx, double cy, double radius, (double R, double G, double B) colour)
    {
        var k = radius * 0.5523;
        _content.Append(CultureInfo.InvariantCulture, $"{colour.R:0.###} {colour.G:0.###} {colour.B:0.###} rg {cx + radius:0.##} {cy:0.##} m ");
        _content.Append(CultureInfo.InvariantCulture, $"{cx + radius:0.##} {cy + k:0.##} {cx + k:0.##} {cy + radius:0.##} {cx:0.##} {cy + radius:0.##} c ");
        _content.Append(CultureInfo.InvariantCulture, $"{cx - k:0.##} {cy + radius:0.##} {cx - radius:0.##} {cy + k:0.##} {cx - radius:0.##} {cy:0.##} c ");
        _content.Append(CultureInfo.InvariantCulture, $"{cx - radius:0.##} {cy - k:0.##} {cx - k:0.##} {cy - radius:0.##} {cx:0.##} {cy - radius:0.##} c ");
        _content.Append(CultureInfo.InvariantCulture, $"{cx + k:0.##} {cy - radius:0.##} {cx + radius:0.##} {cy - k:0.##} {cx + radius:0.##} {cy:0.##} c h f 0 0 0 rg\n");
    }

    private void Diamond(double cx, double cy, double radius, (double R, double G, double B) colour)
        => _content.Append(CultureInfo.InvariantCulture,
            $"{colour.R:0.###} {colour.G:0.###} {colour.B:0.###} rg {cx:0.##} {cy + radius:0.##} m {cx + radius:0.##} {cy:0.##} l {cx:0.##} {cy - radius:0.##} l {cx - radius:0.##} {cy:0.##} l h f 0 0 0 rg\n");

    // A wedge is the centre, a radial edge, then the outer arc split so no bezier segment exceeds a quarter turn.
    private void Wedge(double cx, double cy, double radius, double from, double to, (double R, double G, double B) colour)
    {
        var segments = Math.Max(1, (int)Math.Ceiling(Math.Abs(to - from) / (Math.PI / 2)));
        var step = (to - from) / segments;
        _content.Append(CultureInfo.InvariantCulture, $"{colour.R:0.###} {colour.G:0.###} {colour.B:0.###} rg {cx:0.##} {cy:0.##} m {cx + (radius * Math.Cos(from)):0.##} {cy + (radius * Math.Sin(from)):0.##} l");
        for (var index = 0; index < segments; index++)
        {
            var a1 = from + (step * index);
            var a2 = a1 + step;
            var alpha = 4.0 / 3.0 * Math.Tan((a2 - a1) / 4);
            var x1 = cx + (radius * Math.Cos(a1));
            var y1 = cy + (radius * Math.Sin(a1));
            var x2 = cx + (radius * Math.Cos(a2));
            var y2 = cy + (radius * Math.Sin(a2));
            _content.Append(CultureInfo.InvariantCulture,
                $" {x1 - (alpha * radius * Math.Sin(a1)):0.##} {y1 + (alpha * radius * Math.Cos(a1)):0.##} {x2 + (alpha * radius * Math.Sin(a2)):0.##} {y2 - (alpha * radius * Math.Cos(a2)):0.##} {x2:0.##} {y2:0.##} c");
        }
        _content.Append(" h f 0 0 0 rg\n");
    }

    private void StartPage()
    {
        _content.Clear();
        if (_plain) return;
        _content.Append("0.04 0.44 0.38 rg\n");
        WriteText(Margin, PageHeight - Margin, true, 15, _title);
        _content.Append("0.45 0.50 0.47 rg\n");
        WriteText(PageWidth - Margin - (int)Measure(_subtitle, 8, false), PageHeight - Margin, false, 8, _subtitle);
        _content.Append("0 0 0 rg\n");
        Rule(PageHeight - Margin - 10);
        _y = PageHeight - Margin - 30;
    }

    private void EndPage()
    {
        // Footers are stamped in End() instead, because the contents page is inserted after the fact and
        // would otherwise leave every following page numbered one too low.
        _pages.Add(_content.ToString());
    }

    private void Advance(int lines = 1)
    {
        _y -= LineHeight * lines;
        if (_y < BottomLimit)
        {
            EndPage();
            StartPage();
        }
    }

    private void EnsureRoom(int lines)
    {
        if (_y - (LineHeight * lines) >= BottomLimit) return;
        EndPage();
        StartPage();
    }

    private void WriteText(int x, int y, bool bold, int size, string value)
    {
        if (string.IsNullOrEmpty(value)) return;
        _content.Append(CultureInfo.InvariantCulture, $"BT /{(bold ? "F2" : "F1")} {size} Tf {x} {y} Td ({Escape(value)}) Tj ET\n");
    }

    private void Rule(int y) => _content.Append(CultureInfo.InvariantCulture, $"0.5 w 0.82 0.87 0.84 RG {Margin} {y} m {PageWidth - Margin} {y} l S 0 0 0 RG\n");

    private static double Measure(string value, int size, bool bold) => value.Length * size * (bold ? BoldGlyphWidth : AverageGlyphWidth);

    // Chart labels have a fixed column, so they shorten at a word boundary. The full text is always in the
    // table beside the chart, so nothing is lost by shortening the label.
    private static string Truncate(string value, int width, int size)
    {
        var maximum = Math.Max(3, (int)(width / (size * AverageGlyphWidth)));
        if (value.Length <= maximum) return value;
        var cut = value[..(maximum - 3)];
        var space = cut.LastIndexOf(' ');
        if (space >= maximum / 2) cut = cut[..space];
        return $"{cut.TrimEnd(' ', ',', '-')}...";
    }

    private static List<string> Wrap(string value, int width, int size, bool bold)
    {
        var maximum = Math.Max(8, (int)(width / (size * (bold ? BoldGlyphWidth : AverageGlyphWidth))));
        var lines = new List<string>();
        var line = new StringBuilder();
        foreach (var word in value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            var candidate = line.Length == 0 ? word : $"{line} {word}";
            if (candidate.Length > maximum && line.Length > 0)
            {
                lines.Add(line.ToString());
                line.Clear().Append(word.Length > maximum ? word[..maximum] : word);
            }
            else
            {
                line.Clear().Append(candidate.Length > maximum ? candidate[..maximum] : candidate);
            }
        }
        if (line.Length > 0) lines.Add(line.ToString());
        return lines.Count == 0 ? [""] : lines;
    }

    // WinAnsi has no glyphs beyond byte range, so unsupported characters are replaced rather than corrupting the stream.
    private static string Escape(string value)
    {
        var builder = new StringBuilder(value.Length + 8);
        foreach (var character in value)
        {
            if (character is '(' or ')' or '\\') builder.Append('\\').Append(character);
            else if (character is '\n' or '\r' or '\t') builder.Append(' ');
            else if (character is '\u2013' or '\u2014' or '\u00b7') builder.Append('-');
            else if (character is '\u2018' or '\u2019') builder.Append('\'');
            else if (character is '\u201c' or '\u201d') builder.Append('"');
            else if (character < 32 || character > 255) builder.Append('?');
            else builder.Append(character);
        }
        return builder.ToString();
    }

    private static byte[] Build(IReadOnlyList<string> pages, string title)
    {
        var objects = new List<string>();
        var fontBase = 3 + (pages.Count * 2);
        var kids = string.Join(" ", Enumerable.Range(0, pages.Count).Select(index => $"{4 + (index * 2)} 0 R"));

        objects.Add("<< /Type /Catalog /Pages 2 0 R >>");
        objects.Add($"<< /Type /Pages /Kids [{kids}] /Count {pages.Count} >>");
        objects.Add($"<< /Title ({Escape(title)}) /Producer (Azure Cost Optimizer) >>");
        foreach (var page in pages)
        {
            var contentIndex = objects.Count + 2;
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PageWidth} {PageHeight}] /Resources << /Font << /F1 {fontBase + 1} 0 R /F2 {fontBase + 2} 0 R >> >> /Contents {contentIndex} 0 R >>");
            objects.Add($"<< /Length {Encoding.ASCII.GetByteCount(page)} >>\nstream\n{page}endstream");
        }
        objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

        var document = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var index = 0; index < objects.Count; index++)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(document.ToString()));
            document.Append(CultureInfo.InvariantCulture, $"{index + 1} 0 obj\n{objects[index]}\nendobj\n");
        }
        var xrefOffset = Encoding.ASCII.GetByteCount(document.ToString());
        document.Append(CultureInfo.InvariantCulture, $"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets) document.Append(CultureInfo.InvariantCulture, $"{offset:D10} 00000 n \n");
        document.Append(CultureInfo.InvariantCulture, $"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n{xrefOffset}\n%%EOF");
        return Encoding.ASCII.GetBytes(document.ToString());
    }
}
