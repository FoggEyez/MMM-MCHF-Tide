"""Pure parser checks. ECONOMY_SOURCE can point to an installed Pi module."""
import datetime as dt
import importlib.util
import io
import os
import pathlib
import unittest
import zipfile

source = pathlib.Path(os.environ.get('ECONOMY_SOURCE', pathlib.Path(__file__).resolve().parents[1]/'fetch_economy.py'))
spec = importlib.util.spec_from_file_location('economy', source)
economy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(economy)

class EconomyTests(unittest.TestCase):
    def test_missing_invalid_and_future_values_are_not_observations(self):
        raw=b'observation_date,UNRATE,DFF\n2026-10-01,4.1,.\n2026-10-02,NaN,3.75\n2099-01-01,99,99\n'
        result=economy.parse_download(raw,dt.date(2026,11,8))
        self.assertEqual(result['UNRATE'],[('2026-10-01',4.1)])
        self.assertEqual(result['DFF'],[('2026-10-02',3.75)])

    def test_zip_combines_frequency_tables(self):
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,'w') as archive:
            archive.writestr('monthly.csv','observation_date,UNRATE\n2026-10-01,4.1\n')
            archive.writestr('daily.csv','observation_date,DGS10\n2026-11-06,4.25\n')
        result=economy.parse_download(buf.getvalue(),dt.date(2026,11,8))
        self.assertEqual(result['DGS10'],[('2026-11-06',4.25)])
        self.assertEqual(result['UNRATE'],[('2026-10-01',4.1)])

    def test_inflation_and_payroll_use_correct_base_periods_and_units(self):
        result=economy.indicators({'CPIAUCNS':[('2025-09-01',300),('2026-08-01',307),('2026-09-01',309)],'PAYEMS':[('2026-09-01',159128),('2026-10-01',159293)],'A191RL1Q225SBEA':[('2026-07-01',3.4)]})
        values={r['id']:r for r in result}
        self.assertAlmostEqual(values['CPIAUCNS']['value'],3)
        self.assertEqual(values['PAYEMS']['value'],165000)
        self.assertIn('annualized',values['A191RL1Q225SBEA']['basis'])

    def test_gaps_never_appear_as_monthly_jobs_or_yearly_inflation(self):
        self.assertEqual(economy.indicators({'CPIAUCNS':[('2026-09-01',309)],'PAYEMS':[('2026-08-01',159128),('2026-10-01',159293)]}),[])

if __name__=='__main__':
    unittest.main()
